# 분류 실험: 워커가 저장한 Gallagher 얼굴을 기준값(distance_threshold)별로 묶어 보고 정답 인물과 비교
# 정답: Gallagher 정답 두 눈이 얼굴 박스 안에 있으면 그 인물 (옆모습 등 정답 없는 얼굴은 채점에서 빼고 묶기에는 포함)
#
# 지표 (정답 있는 얼굴끼리의 모든 쌍 기준)
#   - 정밀도: 같은 폴더로 묶인 쌍 중 실제 같은 사람 비율 (낮으면 다른 사람이 한 폴더에 섞임 → 참가자가 남의 사진을 봄)
#   - 재현율: 실제 같은 사람 쌍 중 같은 폴더로 묶인 비율 (낮으면 한 사람이 여러 폴더로 쪼개짐 → 사진 일부를 못 찾음)
#   - 한 사진 충돌: 같은 사진의 서로 다른 얼굴이 한 폴더에 들어간 수 (한 사진에 같은 사람이 두 번 나올 수 없으니 오류)
#
# 준비: extraction 실험으로 GALLAGHER 행사 사진이 extracted 상태여야 함 (워커 실행 완료)
# 실행: backend/에서 uv run python -m clustering.experiments.evaluate_gallagher_clustering [--apply 0.6]
#   --apply 기준값: 그 기준값으로 실제 분류해 persons 저장 + 사람 폴더 그림 저장, 행사는 open으로
#                   (로컬 실험이라 Object Storage 보관은 건너뜀. 로컬 개발 DB에서만 실행)
import argparse
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

import cv2
import numpy
from sqlalchemy import select

from clustering.face_grouping import DEFAULT_DISTANCE_THRESHOLD, group_faces
from clustering.service import cluster_event_faces
from database.connection import database_session_scope
from database.models import Event, EventStatus, Face, Person, Photo
from extraction.face_analyzer import read_image

BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
DATASET_DIRECTORY = BACKEND_DIRECTORY / "datasets" / "gallagher"
RESULT_DIRECTORY = DATASET_DIRECTORY / "results" / "clustering"   # datasets/ 아래라 git에서 제외됨
EXPERIMENT_ACCESS_CODE = "GALLAGHER"
THRESHOLDS = [0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80]
CROP_SIZE = 96              # 사람 폴더 그림에서 얼굴 1칸 크기(px)
FOLDER_IMAGE_PERSON_COUNT = 16
FOLDER_IMAGE_FACE_COUNT = 12


def write_image(path: Path, image: numpy.ndarray) -> None:
    # cv2.imwrite는 한글 경로에 저장을 못 해서 인코딩한 바이트를 직접 씀
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
    def is_inside(point):
        return (bounding_box["x"] <= point[0] <= bounding_box["x"] + bounding_box["w"]
                and bounding_box["y"] <= point[1] <= bounding_box["y"] + bounding_box["h"])
    for left_eye, right_eye, person_number in eyes:
        if is_inside(left_eye) and is_inside(right_eye):
            return person_number
    return None


def score(cluster_by_face: list[int], truth_by_face: list[int | None], photo_by_face: list[int]) -> dict:
    labeled = [index for index, truth in enumerate(truth_by_face) if truth is not None]
    true_positive = predicted_pairs = actual_pairs = 0
    for first, second in combinations(labeled, 2):
        same_cluster = cluster_by_face[first] == cluster_by_face[second]
        same_person = truth_by_face[first] == truth_by_face[second]
        predicted_pairs += same_cluster
        actual_pairs += same_person
        true_positive += same_cluster and same_person
    precision = true_positive / predicted_pairs if predicted_pairs else 1.0
    recall = true_positive / actual_pairs if actual_pairs else 1.0
    same_photo_conflicts = sum(
        count - 1 for count in Counter(zip(cluster_by_face, photo_by_face)).values() if count > 1
    )
    return {"precision": precision, "recall": recall,
            "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
            "conflicts": same_photo_conflicts}


def crop_face(image: numpy.ndarray, bounding_box: dict) -> numpy.ndarray:
    margin = int(max(bounding_box["w"], bounding_box["h"]) * 0.2)
    y0, x0 = max(bounding_box["y"] - margin, 0), max(bounding_box["x"] - margin, 0)
    y1 = min(bounding_box["y"] + bounding_box["h"] + margin, image.shape[0])
    x1 = min(bounding_box["x"] + bounding_box["w"] + margin, image.shape[1])
    return cv2.resize(image[y0:y1, x0:x1], (CROP_SIZE, CROP_SIZE), interpolation=cv2.INTER_AREA)


def draw_person_folders(folders: list[tuple[str, int, list[tuple[str, dict]]]]) -> numpy.ndarray:
    # 한 줄 = 사람 폴더 1개: 첫 칸이 대표 얼굴(빨간 테두리), 이어서 소속 얼굴들
    rows = []
    image_cache = {}
    for label, representative_index, face_items in folders:
        cells = []
        for index, (nas_path, bounding_box) in enumerate(face_items[:FOLDER_IMAGE_FACE_COUNT]):
            if nas_path not in image_cache:
                image_cache[nas_path] = read_image(Path(nas_path))
            cell = crop_face(image_cache[nas_path], bounding_box)
            if index == representative_index:
                cv2.rectangle(cell, (0, 0), (CROP_SIZE - 1, CROP_SIZE - 1), (0, 0, 255), 3)
            cells.append(cell)
        cells += [numpy.full((CROP_SIZE, CROP_SIZE, 3), 255, numpy.uint8)] * (FOLDER_IMAGE_FACE_COUNT - len(cells))
        title = numpy.full((CROP_SIZE, CROP_SIZE * 2, 3), 255, numpy.uint8)
        cv2.putText(title, f"{label} ({len(face_items)})", (6, CROP_SIZE // 2), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 1)
        rows.append(numpy.hstack([title, *cells]))
    return numpy.vstack(rows)


argument_parser = argparse.ArgumentParser()
argument_parser.add_argument("--apply", type=float, metavar="THRESHOLD",
                             help="이 기준값으로 실제 분류해 persons 저장 (행사를 open으로)")
arguments = argument_parser.parse_args()

ground_truth_eyes = load_ground_truth_eyes()
with database_session_scope() as database_session:
    event = database_session.scalars(select(Event).where(Event.access_code == EXPERIMENT_ACCESS_CODE)).one()
    photos_by_id = {photo.id: photo for photo in database_session.scalars(select(Photo).where(Photo.event_id == event.id))}
    faces = list(database_session.scalars(select(Face).where(Face.event_id == event.id).order_by(Face.id)))
    embeddings = numpy.stack([numpy.asarray(face.embedding, dtype=numpy.float64) for face in faces])
    photo_by_face = [face.photo_id for face in faces]
    areas = numpy.array([face.bounding_box["w"] * face.bounding_box["h"] for face in faces])
    truth_by_face = [find_ground_truth_person(face.bounding_box, ground_truth_eyes[photos_by_id[face.photo_id].file_name])
                     for face in faces]
    event_id = event.id

labeled_count = sum(truth is not None for truth in truth_by_face)
print(f"얼굴 {len(faces)}개 (정답 있는 얼굴 {labeled_count}개, 정답 인물 {len(set(truth_by_face) - {None})}명)")
print(f"\n{'기준 거리':>8} {'폴더 수':>6} {'2장 이상':>7} {'정밀도':>6} {'재현율':>6} {'F1':>6} {'한 사진 충돌':>9}")
for threshold in THRESHOLDS:
    groups = group_faces(embeddings, photo_by_face, areas, distance_threshold=threshold)
    cluster_by_face = [0] * len(faces)
    for group_number, group in enumerate(groups):
        for index in group.face_indexes:
            cluster_by_face[index] = group_number
    result = score(cluster_by_face, truth_by_face, photo_by_face)
    marker = " ← 현재 기본값" if threshold == DEFAULT_DISTANCE_THRESHOLD else ""
    print(f"{threshold:>10.2f} {len(groups):>8} {sum(group.photo_count >= 2 for group in groups):>9} "
          f"{result['precision']:>9.3f} {result['recall']:>9.3f} {result['f1']:>8.3f} {result['conflicts']:>10}{marker}")

if arguments.apply is not None:
    with database_session_scope() as database_session:
        event = database_session.get(Event, event_id)
        event.status = EventStatus.CLUSTERING   # 분류는 clustering 상태에서만 동작
        clustering_result = cluster_event_faces(database_session, event_id, distance_threshold=arguments.apply)
        event.status = EventStatus.OPEN          # 로컬 실험: 보관(Object Storage)은 건너뛰고 바로 공개
        persons = list(database_session.scalars(select(Person).where(Person.event_id == event_id).order_by(Person.id)))
        face_by_id = {face.id: face for face in database_session.scalars(select(Face).where(Face.event_id == event_id))}
        folders = []
        for person in persons[:FOLDER_IMAGE_PERSON_COUNT]:
            person_faces = sorted((face for face in face_by_id.values() if face.person_id == person.id), key=lambda face: face.id)
            face_items = [(photos_by_id[face.photo_id].nas_path, dict(face.bounding_box)) for face in person_faces]
            representative_index = next(index for index, face in enumerate(person_faces)
                                        if face.id == person.representative_face_id)
            # 대표 얼굴이 그림 범위 밖이면 맨 앞으로 옮겨서 항상 보이게 함
            if representative_index >= FOLDER_IMAGE_FACE_COUNT:
                face_items.insert(0, face_items.pop(representative_index))
                representative_index = 0
            folders.append((person.label, representative_index, face_items))
    print(f"\n기준 거리 {arguments.apply}로 분류 저장: 얼굴 {clustering_result.face_count}개 → 사람 {clustering_result.person_count}명, 행사 open")
    output_path = RESULT_DIRECTORY / f"person_folders_{arguments.apply:.2f}.jpg"
    write_image(output_path, draw_person_folders(folders))
    print("사람 폴더 그림:", output_path.relative_to(BACKEND_DIRECTORY), "(빨간 테두리 = 대표 얼굴)")
