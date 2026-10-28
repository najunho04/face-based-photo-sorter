# 셀카 매칭 실험: Gallagher 정답으로 "사람 폴더"를 만들고, 폴더에 넣지 않은 얼굴을 셀카처럼 잘라 넣어서
# 그 사람이 1순위로 나오는지 확인 + 기준값(minimum_similarity)별 결과 비교
#
# 왜 정답으로 폴더를 만드나: 실제 분류(clustering/)는 팀원 담당이라 아직 없음.
# 분류가 "완벽하게 됐다"고 가정하고 매칭만 따로 평가하는 것 (분류 실수는 섞이지 않음)
#
# 준비: extraction 실험으로 GALLAGHER 행사 사진이 extracted 상태여야 함 (워커 실행 완료)
# 실행: backend/에서 uv run python -m matching.experiments.evaluate_selfie_matching
# 주의: 실험 행사의 persons를 새로 만들고 행사 상태를 open으로 바꿈 (로컬 개발 DB에서만 실행)
from collections import defaultdict
from pathlib import Path

import cv2
import numpy
from sqlalchemy import delete, select, update

from database.connection import database_session_scope
from database.models import Event, EventStatus, Face, Person, Photo
from extraction.face_analyzer import FaceAnalyzer, read_image, read_image_from_bytes
from matching.person_search import find_matching_persons
from matching.selfie import select_selfie_face
from core.error_codes import ApplicationError

BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
DATASET_DIRECTORY = BACKEND_DIRECTORY / "datasets" / "gallagher"
RESULT_DIRECTORY = DATASET_DIRECTORY / "results" / "matching"   # datasets/ 아래라 git에서 제외됨
EXPERIMENT_ACCESS_CODE = "GALLAGHER"
MINIMUM_FACES_PER_PERSON = 4      # 폴더를 만들고 셀카 질의도 뽑으려면 얼굴이 이만큼은 있어야 함
QUERY_EVERY_NTH_FACE = 3          # 사람마다 3번째 얼굴마다 1개를 셀카 질의로 빼고 나머지로 폴더를 만듦
THRESHOLDS = [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60]
CROP_SIZE = 160                   # 결과 그림에서 얼굴 1칸 크기(px)


def write_image(path: Path, image: numpy.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imencode(".jpg", image)[1].tofile(path)


def load_ground_truth_eyes() -> dict[str, list]:
    # 사진 이름 → [(왼눈, 오른눈, 인물 번호), ...]
    ground_truth_eyes = defaultdict(list)
    with open(DATASET_DIRECTORY / "GallagherDatasetGT.txt") as ground_truth_file:
        for line in ground_truth_file:
            columns = line.split()
            if len(columns) >= 6:
                left_x, left_y, right_x, right_y, person_number = map(int, columns[1:6])
                ground_truth_eyes[columns[0]].append(((left_x, left_y), (right_x, right_y), person_number))
    return ground_truth_eyes


def find_ground_truth_person(bounding_box: dict, eyes: list) -> int | None:
    # 정답 두 눈이 모두 얼굴 박스 안에 들어 있으면 그 사람 (옆모습 등 정답 없는 얼굴은 None)
    def is_inside(point):
        return (bounding_box["x"] <= point[0] <= bounding_box["x"] + bounding_box["w"]
                and bounding_box["y"] <= point[1] <= bounding_box["y"] + bounding_box["h"])
    for left_eye, right_eye, person_number in eyes:
        if is_inside(left_eye) and is_inside(right_eye):
            return person_number
    return None


def crop_face(image: numpy.ndarray, bounding_box: dict, margin_ratio: float) -> numpy.ndarray:
    # 얼굴 박스 주변을 여유 있게 잘라냄 (셀카처럼 얼굴이 크게 나온 사진을 흉내)
    margin = int(max(bounding_box["w"], bounding_box["h"]) * margin_ratio)
    y0 = max(bounding_box["y"] - margin, 0)
    x0 = max(bounding_box["x"] - margin, 0)
    y1 = min(bounding_box["y"] + bounding_box["h"] + margin, image.shape[0])
    x1 = min(bounding_box["x"] + bounding_box["w"] + margin, image.shape[1])
    return image[y0:y1, x0:x1]


def to_square(image: numpy.ndarray) -> numpy.ndarray:
    return cv2.resize(image, (CROP_SIZE, CROP_SIZE), interpolation=cv2.INTER_AREA)


def build_selfie_bytes(face_crop: numpy.ndarray) -> bytes:
    # 셀카처럼 얼굴이 화면 대부분을 차지하도록 최소 480px로 키운 뒤 jpg 바이트로 (API가 받는 형태)
    scale = max(1.0, 480 / max(face_crop.shape[:2]))
    selfie_image = cv2.resize(face_crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    return cv2.imencode(".jpg", selfie_image)[1].tobytes()


ground_truth_eyes = load_ground_truth_eyes()

# 1) 실험 행사의 얼굴을 정답 인물별로 나누고, 사람마다 질의(셀카 역할)와 폴더용으로 분리
with database_session_scope() as database_session:
    event = database_session.scalars(select(Event).where(Event.access_code == EXPERIMENT_ACCESS_CODE)).one()
    photos_by_id = {photo.id: photo for photo in database_session.scalars(select(Photo).where(Photo.event_id == event.id))}
    faces = list(database_session.scalars(select(Face).where(Face.event_id == event.id).order_by(Face.id)))

    faces_by_person = defaultdict(list)
    for face in faces:
        person_number = find_ground_truth_person(face.bounding_box, ground_truth_eyes[photos_by_id[face.photo_id].file_name])
        if person_number is not None:
            faces_by_person[person_number].append(face)

    folder_faces_by_person, query_faces = {}, []
    for person_number, person_faces in faces_by_person.items():
        if len(person_faces) < MINIMUM_FACES_PER_PERSON:
            continue
        queries = person_faces[QUERY_EVERY_NTH_FACE - 1::QUERY_EVERY_NTH_FACE]
        folder_faces_by_person[person_number] = [face for face in person_faces if face not in queries]
        query_faces.extend((person_number, face) for face in queries)

    # 2) 정답 폴더를 persons로 저장 (분류가 완벽하다고 가정): centroid = 폴더 얼굴 벡터 평균을 길이 1로
    database_session.execute(update(Face).where(Face.event_id == event.id).values(person_id=None))
    database_session.execute(delete(Person).where(Person.event_id == event.id))
    label_by_person_id = {}
    for person_number, folder_faces in sorted(folder_faces_by_person.items()):
        embeddings = numpy.array([numpy.asarray(face.embedding, dtype=numpy.float32) for face in folder_faces])
        centroid = embeddings.mean(axis=0)
        centroid /= numpy.linalg.norm(centroid)
        largest_face = max(folder_faces, key=lambda face: face.bounding_box["w"] * face.bounding_box["h"])
        person = Person(event_id=event.id, label=f"user{person_number}", centroid=centroid,
                        representative_face_id=largest_face.id)
        database_session.add(person)
        database_session.flush()
        for face in folder_faces:
            face.person_id = person.id
        label_by_person_id[person.id] = person.label
    event.status = EventStatus.OPEN   # 매칭은 open 행사에서만 동작
    representative_face_by_label = {}
    for person in database_session.scalars(select(Person).where(Person.event_id == event.id)):
        representative_face = database_session.get(Face, person.representative_face_id)
        representative_face_by_label[person.label] = (photos_by_id[representative_face.photo_id].nas_path,
                                                      representative_face.bounding_box)
    query_items = [(person_number, photos_by_id[face.photo_id].nas_path, dict(face.bounding_box))
                   for person_number, face in query_faces]
    event_id = event.id

print(f"사람 폴더 {len(folder_faces_by_person)}명 만듦: "
      + ", ".join(f"user{number}({len(faces)}개)" for number, faces in sorted(folder_faces_by_person.items())))
print(f"셀카 질의 {len(query_items)}개로 매칭 시험 (실제 InsightFace로 다시 분석)")

# 3) 질의마다: 얼굴을 잘라 셀카 바이트로 → 실제 분석 → 모든 사람과의 유사도를 받아 둠 (기준값별 비교용)
face_analyzer = FaceAnalyzer()
results = []   # (정답 라벨, [(라벨, 유사도) 유사도 높은 순], 질의 얼굴 그림)
with database_session_scope() as database_session:
    for person_number, nas_path, bounding_box in query_items:
        face_crop = crop_face(read_image(nas_path), bounding_box, margin_ratio=0.6)
        try:
            selfie_face = select_selfie_face(face_analyzer.analyze(read_image_from_bytes(build_selfie_bytes(face_crop))))
        except ApplicationError:
            results.append((f"user{person_number}", None, face_crop))   # 잘라 낸 사진에서 얼굴을 못 찾음
            continue
        all_persons = find_matching_persons(database_session, event_id, selfie_face.embedding,
                                            minimum_similarity=-1.0, maximum_count=100)
        results.append((f"user{person_number}", [(person.label, person.similarity) for person in all_persons], face_crop))

# 4) 기준값별 결과표: 실제 API는 기준값 이상 상위 3명만 보여줌
detected_results = [result for result in results if result[1] is not None]
print(f"\n셀카에서 얼굴 못 찾음: {len(results) - len(detected_results)}개 / {len(results)}개")
print("기준값  1순위정답  3명안에정답  후보없음  1순위가남(위험)")
for threshold in THRESHOLDS:
    first_correct = in_top_three = no_candidate = wrong_first = 0
    for true_label, ranked, _ in detected_results:
        shown = [label for label, similarity in ranked if similarity >= threshold][:3]
        if not shown:
            no_candidate += 1
        elif shown[0] == true_label:
            first_correct += 1
        else:
            wrong_first += 1
        in_top_three += true_label in shown
    total = len(detected_results)
    print(f"  {threshold:.2f}   {first_correct / total:6.1%}     {in_top_three / total:6.1%}    "
          f"{no_candidate / total:6.1%}    {wrong_first / total:6.1%}")

true_similarities = [dict(ranked)[true_label] for true_label, ranked, _ in detected_results if true_label in dict(ranked)]
other_best = [max(similarity for label, similarity in ranked if label != true_label) for true_label, ranked, _ in detected_results]
print(f"\n본인 폴더와의 유사도: 평균 {numpy.mean(true_similarities):.2f}, 최소 {numpy.min(true_similarities):.2f}")
print(f"남 중 가장 닮은 폴더와의 유사도: 평균 {numpy.mean(other_best):.2f}, 최대 {numpy.max(other_best):.2f}")

# 5) 그림: 한 줄 = [셀카 질의 | 1순위 | 2순위 | 3순위] (기준값 0.40), 정답이면 초록 테두리, 남이면 빨강
representative_crop_by_label = {
    label: to_square(crop_face(read_image(nas_path), bounding_box, margin_ratio=0.3))
    for label, (nas_path, bounding_box) in representative_face_by_label.items()
}
rows = []
for true_label, ranked, face_crop in results[:20]:
    cells = [to_square(face_crop)]
    cv2.putText(cells[0], f"selfie {true_label}", (4, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
    shown = [] if ranked is None else [(label, similarity) for label, similarity in ranked if similarity >= 0.40][:3]
    for label, similarity in shown:
        cell = representative_crop_by_label[label].copy()
        color = (0, 200, 0) if label == true_label else (0, 0, 230)
        cv2.rectangle(cell, (0, 0), (CROP_SIZE - 1, CROP_SIZE - 1), color, 6)
        cv2.putText(cell, f"{label} {similarity:.2f}", (8, CROP_SIZE - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        cells.append(cell)
    cells += [numpy.full((CROP_SIZE, CROP_SIZE, 3), 40, dtype=numpy.uint8)] * (4 - len(cells))
    rows.append(numpy.hstack(cells))
write_image(RESULT_DIRECTORY / "matching_results.jpg", numpy.vstack(rows))
print("결과 그림:", RESULT_DIRECTORY / "matching_results.jpg")
