"""워커 작업 잡기(claim) 테스트. photos.status를 작업 큐로 씀 (docs/erd.md "워커 큐 규칙" 1번).

로컬 DB가 필요함 (backend/에서 docker compose up -d). 각 테스트는 끝나면 롤백됨.
여러 워커가 동시에 잡는 상황(SKIP LOCKED)은 커넥션 2개가 필요해서 8단계에서 따로 검증.
"""

import numpy
import pytest
from sqlalchemy import select

from database.face_contract import EMBEDDING_DIMENSION, FaceContractError
from database.models import Event, Face, Photo, PhotoStatus
from extraction.face_analyzer import DetectedFace
from extraction.photo_queue import (
    claim_next_photo,
    complete_photo,
    mark_photo_failed,
    release_photo_for_retry,
)


def create_event(database_session, access_code: str = "Q1W2E3") -> Event:
    event = Event(name="큐 테스트 행사", access_code=access_code)
    database_session.add(event)
    database_session.flush()   # INSERT를 실행해 id를 받아옴 (아직 커밋 아님)
    return event


def create_photo(
    database_session,
    event: Event,
    file_name: str,
    status: PhotoStatus = PhotoStatus.UPLOADED,
    worker_id: str | None = None,
) -> Photo:
    photo = Photo(
        event=event,
        file_name=file_name,
        nas_path=f"/nas/event{event.id}/{file_name}",
        status=status,
        worker_id=worker_id,
    )
    database_session.add(photo)
    database_session.flush()
    return photo


def test_claim_takes_oldest_uploaded_photo_and_marks_processing(database_session):
    event = create_event(database_session)
    first_photo = create_photo(database_session, event, "IMG_0001.jpg")
    create_photo(database_session, event, "IMG_0002.jpg")

    claimed_photo = claim_next_photo(database_session, worker_id="worker-1")

    # id가 가장 작은(먼저 올라온) 사진부터 처리
    assert claimed_photo.id == first_photo.id
    assert claimed_photo.status == PhotoStatus.PROCESSING


def test_claim_records_worker_id_and_claimed_at(database_session):
    # worker_id: 실패 추적용, claimed_at: 워커가 죽었을 때 5분 지나면 복구하는 기준
    event = create_event(database_session)
    create_photo(database_session, event, "IMG_0001.jpg")

    claimed_photo = claim_next_photo(database_session, worker_id="worker-1")
    database_session.refresh(claimed_photo)   # DB에 실제로 저장된 값으로 다시 읽음

    assert claimed_photo.worker_id == "worker-1"
    assert claimed_photo.claimed_at is not None


def test_claim_twice_returns_different_photos(database_session):
    # 이미 processing이 된 사진은 다시 잡지 않음
    event = create_event(database_session)
    create_photo(database_session, event, "IMG_0001.jpg")
    create_photo(database_session, event, "IMG_0002.jpg")

    first_claimed_photo = claim_next_photo(database_session, worker_id="worker-1")
    second_claimed_photo = claim_next_photo(database_session, worker_id="worker-1")

    assert first_claimed_photo.id != second_claimed_photo.id


def test_claim_ignores_photos_that_are_not_uploaded(database_session):
    # processing(다른 워커가 처리 중), extracted(완료), failed(영구 오류)는 건너뜀
    event = create_event(database_session)
    create_photo(database_session, event, "IMG_0001.jpg", status=PhotoStatus.PROCESSING)
    create_photo(database_session, event, "IMG_0002.jpg", status=PhotoStatus.EXTRACTED)
    create_photo(database_session, event, "IMG_0003.jpg", status=PhotoStatus.FAILED)
    waiting_photo = create_photo(database_session, event, "IMG_0004.jpg")

    claimed_photo = claim_next_photo(database_session, worker_id="worker-1")

    assert claimed_photo.id == waiting_photo.id


def test_claim_returns_none_when_queue_is_empty(database_session):
    # 할 일이 없으면 None → 워커는 몇 초 쉬었다가 다시 확인
    event = create_event(database_session)
    create_photo(database_session, event, "IMG_0001.jpg", status=PhotoStatus.EXTRACTED)

    assert claim_next_photo(database_session, worker_id="worker-1") is None


# --- 결과 저장·실패 처리 (워커 큐 규칙 2, 3, 5번) ---

def create_claimed_photo(database_session, worker_id: str = "worker-1") -> Photo:
    # worker-1이 잡아서 처리 중인 사진
    event = create_event(database_session)
    return create_photo(database_session, event, "IMG_0001.jpg", status=PhotoStatus.PROCESSING, worker_id=worker_id)


def build_detected_face(seed: int, x: int = 100) -> DetectedFace:
    # 길이 1인 512차원 벡터를 가진 얼굴 (seed마다 다른 벡터)
    random_generator = numpy.random.default_rng(seed)
    embedding = random_generator.normal(size=EMBEDDING_DIMENSION).astype(numpy.float32)
    embedding /= numpy.linalg.norm(embedding)
    return DetectedFace(bounding_box={"x": x, "y": 50, "w": 120, "h": 150}, embedding=embedding, detection_score=0.9)


def find_faces_of_photo(database_session, photo: Photo) -> list[Face]:
    return list(database_session.scalars(select(Face).where(Face.photo_id == photo.id).order_by(Face.id)))


def test_complete_saves_faces_and_marks_extracted(database_session):
    # 규칙 2번: faces INSERT + photos.status='extracted' (한 트랜잭션은 호출한 쪽의 database_session_scope가 담당)
    photo = create_claimed_photo(database_session)
    detected_faces = [build_detected_face(seed=1, x=100), build_detected_face(seed=2, x=400)]

    is_completed = complete_photo(database_session, photo.id, worker_id="worker-1", detected_faces=detected_faces)
    database_session.refresh(photo)

    assert is_completed is True
    assert photo.status == PhotoStatus.EXTRACTED
    saved_faces = find_faces_of_photo(database_session, photo)
    assert [face.bounding_box for face in saved_faces] == [face.bounding_box for face in detected_faces]
    assert all(face.event_id == photo.event_id for face in saved_faces)   # 행사 단위 분류에 필요
    assert all(face.person_id is None for face in saved_faces)            # 분류 전이라 비어 있음
    assert numpy.allclose(saved_faces[0].embedding, detected_faces[0].embedding, atol=1e-6)


def test_complete_marks_extracted_even_when_no_face_found(database_session):
    # 얼굴 없는 사진(풍경 등)도 처리 완료. 안 그러면 분류가 이 사진을 영원히 기다림
    photo = create_claimed_photo(database_session)

    complete_photo(database_session, photo.id, worker_id="worker-1", detected_faces=[])
    database_session.refresh(photo)

    assert photo.status == PhotoStatus.EXTRACTED
    assert find_faces_of_photo(database_session, photo) == []


def test_complete_replaces_faces_saved_before(database_session):
    # 같은 사진을 다시 처리해도 얼굴이 두 번 쌓이지 않음 (재실행해도 안전)
    photo = create_claimed_photo(database_session)
    database_session.add(Face(
        photo_id=photo.id,
        event_id=photo.event_id,
        bounding_box={"x": 1, "y": 1, "w": 50, "h": 50},
        embedding=build_detected_face(seed=9).embedding,
    ))
    database_session.flush()

    complete_photo(database_session, photo.id, worker_id="worker-1", detected_faces=[build_detected_face(seed=1)])

    assert len(find_faces_of_photo(database_session, photo)) == 1


def test_complete_is_ignored_when_photo_was_taken_over_by_another_worker(database_session):
    # 오래 걸리는 사이 웹서버가 5분 복구로 되돌렸고 다른 워커가 다시 잡은 경우 → 늦게 끝난 워커의 결과는 버림
    photo = create_claimed_photo(database_session, worker_id="worker-2")

    is_completed = complete_photo(database_session, photo.id, worker_id="worker-1", detected_faces=[build_detected_face(seed=1)])
    database_session.refresh(photo)

    assert is_completed is False
    assert photo.status == PhotoStatus.PROCESSING
    assert find_faces_of_photo(database_session, photo) == []


def test_complete_rejects_face_that_breaks_team_contract(database_session):
    # INSERT 직전에 팀 계약(face_contract)을 검사 → 잘못된 값이 DB에 들어가지 않게 예외
    photo = create_claimed_photo(database_session)
    broken_face = build_detected_face(seed=1)
    broken_face.embedding = broken_face.embedding * 23.0   # 정규화 안 된 벡터

    with pytest.raises(FaceContractError):
        complete_photo(database_session, photo.id, worker_id="worker-1", detected_faces=[broken_face])


def test_release_for_retry_puts_photo_back_to_queue(database_session):
    # 규칙 3번 일시 오류(DB 끊김 등): uploaded로 되돌려서 아무 워커나 다시 잡을 수 있게
    photo = create_claimed_photo(database_session)

    release_photo_for_retry(database_session, photo.id)
    database_session.refresh(photo)

    assert photo.status == PhotoStatus.UPLOADED
    assert photo.worker_id is None
    assert photo.claimed_at is None


def test_mark_failed_keeps_worker_id_for_tracking(database_session):
    # 규칙 5번 영구 오류(파일 없음·손상): failed로 바꾸고, 어느 워커에서 실패했는지 남김
    photo = create_claimed_photo(database_session)

    mark_photo_failed(database_session, photo.id)
    database_session.refresh(photo)

    assert photo.status == PhotoStatus.FAILED
    assert photo.worker_id == "worker-1"
