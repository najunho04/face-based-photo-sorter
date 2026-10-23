# DB(faces)에 저장된 워커 결과를 사진 위에 그려서 눈으로 확인하는 실험
# 초록 박스 = 워커가 저장한 얼굴(faces.bbox), 빨간 점 = Gallagher 정답 눈 좌표
# 결과: datasets/gallagher/results/extracted/ 에 사진별 이미지 + 여러 장을 한눈에 보는 overview.jpg
# 실행: backend/에서 uv run python -m extraction.experiments.draw_extraction_results [--photo-count 12]
import argparse
from collections import defaultdict
from pathlib import Path

import cv2
import numpy
from sqlalchemy import select

from database.connection import database_session_scope
from database.models import Event, Face, Photo
from extraction.face_analyzer import read_image

BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
DATASET_DIRECTORY = BACKEND_DIRECTORY / "datasets" / "gallagher"
RESULT_DIRECTORY = DATASET_DIRECTORY / "results" / "extracted"   # datasets/ 아래라 git에서 제외됨
EXPERIMENT_ACCESS_CODE = "GALLAGHER"
OVERVIEW_CELL_SIZE = 480    # 한눈에 보기 이미지에서 사진 1칸의 크기(px)
OVERVIEW_COLUMN_COUNT = 4


def write_image(path: Path, image: numpy.ndarray) -> None:
    # cv2.imwrite는 한글 경로에 저장을 못 해서 인코딩한 바이트를 직접 씀
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imencode(".jpg", image)[1].tofile(path)


def load_ground_truth_eyes() -> dict[str, list[tuple[tuple[int, int], tuple[int, int], int]]]:
    # 사진 이름 → [(왼눈, 오른눈, 인물 번호), ...]
    ground_truth_eyes = defaultdict(list)
    with open(DATASET_DIRECTORY / "GallagherDatasetGT.txt") as ground_truth_file:
        for line in ground_truth_file:
            columns = line.split()
            if len(columns) >= 6:
                left_x, left_y, right_x, right_y, person_number = map(int, columns[1:6])
                ground_truth_eyes[columns[0]].append(((left_x, left_y), (right_x, right_y), person_number))
    return ground_truth_eyes


def draw_faces(image: numpy.ndarray, faces: list[Face], eyes: list) -> numpy.ndarray:
    result_image = image.copy()
    # 사진 크기에 맞춰 선 굵기·글자 크기를 키움 (큰 사진에서 선이 안 보이는 것 방지)
    line_thickness = max(2, image.shape[1] // 400)
    font_scale = max(0.8, image.shape[1] / 1200)

    for face_number, face in enumerate(faces, start=1):
        box = face.bounding_box   # 원본 사진 기준 {"x","y","w","h"}
        top_left = (box["x"], box["y"])
        bottom_right = (box["x"] + box["w"], box["y"] + box["h"])
        cv2.rectangle(result_image, top_left, bottom_right, (0, 255, 0), line_thickness)
        cv2.putText(result_image, str(face_number), (box["x"], max(box["y"] - 10, 30)),
                    cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 255, 0), line_thickness)

    for left_eye, right_eye, person_number in eyes:
        cv2.circle(result_image, left_eye, line_thickness * 3, (0, 0, 255), -1)
        cv2.circle(result_image, right_eye, line_thickness * 3, (0, 0, 255), -1)

    summary = f"faces {len(faces)} / ground truth {len(eyes)}"
    cv2.putText(result_image, summary, (20, int(60 * font_scale)),
                cv2.FONT_HERSHEY_SIMPLEX, font_scale * 1.5, (0, 255, 255), line_thickness + 1)
    return result_image


def fit_into_cell(image: numpy.ndarray) -> numpy.ndarray:
    # 가로·세로 비율을 유지한 채 정사각형 칸 안에 맞추고, 남는 곳은 검은색으로 채움
    height, width = image.shape[:2]
    scale = OVERVIEW_CELL_SIZE / max(height, width)
    resized_image = cv2.resize(image, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA)
    cell = numpy.zeros((OVERVIEW_CELL_SIZE, OVERVIEW_CELL_SIZE, 3), dtype=numpy.uint8)
    top = (OVERVIEW_CELL_SIZE - resized_image.shape[0]) // 2
    left = (OVERVIEW_CELL_SIZE - resized_image.shape[1]) // 2
    cell[top:top + resized_image.shape[0], left:left + resized_image.shape[1]] = resized_image
    return cell


def build_overview(cells: list[numpy.ndarray]) -> numpy.ndarray:
    # 칸들을 4열 격자로 이어 붙임 (마지막 줄 빈칸은 검은색)
    row_count = (len(cells) + OVERVIEW_COLUMN_COUNT - 1) // OVERVIEW_COLUMN_COUNT
    blank_cell = numpy.zeros_like(cells[0])
    padded_cells = cells + [blank_cell] * (row_count * OVERVIEW_COLUMN_COUNT - len(cells))
    rows = [
        numpy.hstack(padded_cells[row_index * OVERVIEW_COLUMN_COUNT:(row_index + 1) * OVERVIEW_COLUMN_COUNT])
        for row_index in range(row_count)
    ]
    return numpy.vstack(rows)


argument_parser = argparse.ArgumentParser()
argument_parser.add_argument("--photo-count", type=int, default=12, help="그려 볼 사진 수 (앞에서부터)")
arguments = argument_parser.parse_args()

ground_truth_eyes = load_ground_truth_eyes()
with database_session_scope() as database_session:
    event = database_session.scalars(select(Event).where(Event.access_code == EXPERIMENT_ACCESS_CODE)).one()
    photos = list(database_session.scalars(
        select(Photo).where(Photo.event_id == event.id).order_by(Photo.id).limit(arguments.photo_count)
    ))
    faces_per_photo = defaultdict(list)
    for face in database_session.scalars(
        select(Face).where(Face.photo_id.in_([photo.id for photo in photos])).order_by(Face.id)
    ):
        faces_per_photo[face.photo_id].append(face)

    overview_cells = []
    for photo in photos:
        result_image = draw_faces(read_image(photo.nas_path), faces_per_photo[photo.id], ground_truth_eyes[photo.file_name])
        write_image(RESULT_DIRECTORY / f"{Path(photo.file_name).stem}.jpg", result_image)
        overview_cells.append(fit_into_cell(result_image))
        print(f"{photo.file_name}: 저장된 얼굴 {len(faces_per_photo[photo.id])}개 / 정답 {len(ground_truth_eyes[photo.file_name])}개")

overview_path = RESULT_DIRECTORY / "overview.jpg"
write_image(overview_path, build_overview(overview_cells))
print("한눈에 보기:", overview_path)
