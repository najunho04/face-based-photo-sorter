"""워커 1회 처리·반복 테스트: 잡기 → NAS에서 읽기 → 분석 → 저장/실패 처리.

로컬 DB가 필요함 (backend/에서 docker compose up -d). 실제 InsightFace 대신 가짜 분석기를 써서 빠르게 검증.
워커는 원래 database_session_scope()로 매번 트랜잭션을 열고 커밋하지만,
테스트에서는 롤백되는 테스트용 세션을 그대로 넘겨서 테스트가 끝나면 데이터가 남지 않게 함.
"""

from contextlib import contextmanager

import cv2
import numpy
from sqlalchemy import select

from database.face_contract import EMBEDDING_DIMENSION
from database.models import Event, Face, Photo, PhotoStatus
from extraction.face_analyzer import DetectedFace
from extraction.worker import ExtractionWorker


class FakeFaceAnalyzer:
    # FaceAnalyzer.analyze(image)만 흉내냄: 정해 둔 얼굴을 돌려주거나, 지정한 예외를 냄
    def __init__(self, detected_faces=None, error: Exception | None = None):
        self.detected_faces = detected_faces or []
        self.error = error
        self.analyzed_count = 0

    def analyze(self, image):
        self.analyzed_count += 1
        if self.error is not None:
            raise self.error
        return self.detected_faces


def build_detected_face(seed: int = 1) -> DetectedFace:
    random_generator = numpy.random.default_rng(seed)
    embedding = random_generator.normal(size=EMBEDDING_DIMENSION).astype(numpy.float32)
    embedding /= numpy.linalg.norm(embedding)
    return DetectedFace(bounding_box={"x": 10, "y": 10, "w": 80, "h": 80}, embedding=embedding, detection_score=0.9)


def write_test_image(path) -> None:
    # 실제로 읽을 수 있는 작은 jpg 파일 (한글 경로에서도 저장되게 imencode + tofile)
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imencode(".jpg", numpy.full((100, 100, 3), 128, dtype=numpy.uint8))[1].tofile(path)


def create_uploaded_photo(database_session, nas_path: str, access_code: str = "W0RK01") -> Photo:
    event = database_session.scalars(select(Event).where(Event.access_code == access_code)).first()
    if event is None:
        event = Event(name="워커 테스트 행사", access_code=access_code)
        database_session.add(event)
        database_session.flush()
    photo = Photo(event=event, file_name=nas_path.rsplit("/", 1)[-1], nas_path=nas_path)
    database_session.add(photo)
    database_session.flush()
    return photo


def build_worker(database_session, face_analyzer, nas_root_path) -> ExtractionWorker:
    @contextmanager
    def test_session_scope():
        # 운영의 database_session_scope 대신: 같은 테스트 세션을 넘기고 블록이 끝나면 DB에 반영(flush)만 함
        yield database_session
        database_session.flush()

    return ExtractionWorker(
        face_analyzer=face_analyzer,
        worker_id="worker-test",
        nas_root_path=str(nas_root_path),
        session_scope=test_session_scope,
    )


def refreshed(database_session, photo: Photo) -> Photo:
    database_session.refresh(photo)
    return photo


def test_process_one_photo_saves_faces_and_marks_extracted(database_session, tmp_path):
    image_path = tmp_path / "event1" / "IMG_0001.jpg"
    write_test_image(image_path)
    photo = create_uploaded_photo(database_session, str(image_path))
    worker = build_worker(database_session, FakeFaceAnalyzer([build_detected_face()]), tmp_path)

    has_processed = worker.process_one_photo()

    assert has_processed is True
    assert refreshed(database_session, photo).status == PhotoStatus.EXTRACTED
    saved_faces = list(database_session.scalars(select(Face).where(Face.photo_id == photo.id)))
    assert len(saved_faces) == 1


def test_process_one_photo_returns_false_when_queue_is_empty(database_session, tmp_path):
    # 할 일이 없으면 False → 반복 루프가 잠깐 쉬었다가 다시 확인
    face_analyzer = FakeFaceAnalyzer()
    worker = build_worker(database_session, face_analyzer, tmp_path)

    assert worker.process_one_photo() is False
    assert face_analyzer.analyzed_count == 0


def test_relative_nas_path_is_read_under_nas_root(database_session, tmp_path):
    # nas_path가 상대 경로면 NAS 루트(로컬 ./nas, 운영 /nas) 아래에서 찾음
    write_test_image(tmp_path / "event1" / "IMG_0002.jpg")
    photo = create_uploaded_photo(database_session, "event1/IMG_0002.jpg")
    worker = build_worker(database_session, FakeFaceAnalyzer([build_detected_face()]), tmp_path)

    worker.process_one_photo()

    assert refreshed(database_session, photo).status == PhotoStatus.EXTRACTED


def test_missing_file_marks_photo_failed(database_session, tmp_path):
    # 영구 오류(파일 없음): failed로 바꾸고 분석기는 부르지 않음
    photo = create_uploaded_photo(database_session, str(tmp_path / "없는사진.jpg"))
    face_analyzer = FakeFaceAnalyzer()
    worker = build_worker(database_session, face_analyzer, tmp_path)

    has_processed = worker.process_one_photo()

    assert has_processed is True   # 실패도 "1장 처리함"으로 보고 바로 다음 사진으로 넘어감
    assert refreshed(database_session, photo).status == PhotoStatus.FAILED
    assert face_analyzer.analyzed_count == 0


def test_analysis_error_marks_photo_failed(database_session, tmp_path):
    # 분석 중 예상 못한 오류: 같은 사진은 다시 해도 또 실패할 가능성이 커서 failed (무한 반복 방지)
    image_path = tmp_path / "IMG_0003.jpg"
    write_test_image(image_path)
    photo = create_uploaded_photo(database_session, str(image_path))
    worker = build_worker(database_session, FakeFaceAnalyzer(error=RuntimeError("model crashed")), tmp_path)

    worker.process_one_photo()

    assert refreshed(database_session, photo).status == PhotoStatus.FAILED


def test_run_until_queue_empty_processes_every_photo(database_session, tmp_path):
    # 실험·부하 테스트용 모드: 대기열이 빌 때까지 처리하고 종료
    photos = []
    for photo_number in range(3):
        image_path = tmp_path / f"IMG_{photo_number}.jpg"
        write_test_image(image_path)
        photos.append(create_uploaded_photo(database_session, str(image_path)))
    worker = build_worker(database_session, FakeFaceAnalyzer([build_detected_face()]), tmp_path)

    processed_count = worker.run(stop_when_queue_empty=True)

    assert processed_count == 3
    assert all(refreshed(database_session, photo).status == PhotoStatus.EXTRACTED for photo in photos)


def test_run_stops_before_next_photo_when_stop_requested(database_session, tmp_path):
    # 종료 신호(SIGTERM)를 받으면 다음 사진을 잡지 않고 멈춤 → 사진이 processing에 걸린 채 남지 않음
    image_path = tmp_path / "IMG_0004.jpg"
    write_test_image(image_path)
    photo = create_uploaded_photo(database_session, str(image_path))
    worker = build_worker(database_session, FakeFaceAnalyzer([build_detected_face()]), tmp_path)

    worker.request_stop()
    processed_count = worker.run()

    assert processed_count == 0
    assert refreshed(database_session, photo).status == PhotoStatus.UPLOADED
