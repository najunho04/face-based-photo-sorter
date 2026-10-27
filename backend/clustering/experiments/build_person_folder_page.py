# 분류 결과를 "사람별 폴더" 모양으로 보는 HTML 1개를 만듦 (프론트가 나오기 전 대체용 확인 화면)
# - 왼쪽: 행사 폴더 아래 user1, user2 ... 폴더 (대표 얼굴 + 사진 수), 오른쪽: 고른 폴더의 사진과 얼굴 위치
# - 대표 얼굴은 API 10과 같은 방식: 원본 사진 + bbox로 CSS에서 잘라 보여줌
# - 대표 얼굴이 왜 뽑혔는지(얼굴 크기 기준, centroid 유사도)를 폴더마다 함께 보여줌
#
# 사진은 썸네일(긴 변 THUMBNAIL_SIZE px)로 줄여 HTML 안에 넣음 → 파일 하나로 열림, 네트워크·서버 불필요
# Gallagher는 재배포 금지라 결과는 datasets/ 아래(git 제외)에만 저장하고 외부에 올리지 않음
#
# 준비: GALLAGHER 행사가 분류된 상태(persons 있음)
# 실행: backend/에서 uv run python -m clustering.experiments.build_person_folder_page
import base64
import json
from pathlib import Path

import cv2
import numpy
from sqlalchemy import select

from clustering.face_grouping import REPRESENTATIVE_MINIMUM_AREA_RATIO
from database.connection import database_session_scope
from database.models import Event, Face, Person, Photo
from extraction.face_analyzer import read_image

BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
OUTPUT_PATH = BACKEND_DIRECTORY / "datasets" / "gallagher" / "results" / "clustering" / "person_folders.html"
EXPERIMENT_ACCESS_CODE = "GALLAGHER"
THUMBNAIL_SIZE = 480
THUMBNAIL_QUALITY = 72


def encode_thumbnail(image: numpy.ndarray) -> str:
    scale = THUMBNAIL_SIZE / max(image.shape[:2])
    thumbnail = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else image
    encoded = cv2.imencode(".jpg", thumbnail, [cv2.IMWRITE_JPEG_QUALITY, THUMBNAIL_QUALITY])[1].tobytes()
    return base64.b64encode(encoded).decode("ascii")


with database_session_scope() as database_session:
    event = database_session.scalars(select(Event).where(Event.access_code == EXPERIMENT_ACCESS_CODE)).one()
    photos = list(database_session.scalars(select(Photo).where(Photo.event_id == event.id).order_by(Photo.id)))
    persons = list(database_session.scalars(select(Person).where(Person.event_id == event.id).order_by(Person.id)))
    faces = list(database_session.scalars(select(Face).where(Face.event_id == event.id).order_by(Face.id)))
    event_info = {"id": event.id, "name": event.name, "status": event.status.value}

    faces_by_person_id = {}
    for face in faces:
        faces_by_person_id.setdefault(face.person_id, []).append(face)

    person_items = []
    for person in persons:
        person_faces = faces_by_person_id.get(person.id, [])
        centroid = numpy.asarray(person.centroid, dtype=numpy.float64)
        areas = [face.bounding_box["w"] * face.bounding_box["h"] for face in person_faces]
        largest_area = max(areas)
        person_items.append({
            "id": person.id,
            "label": person.label,
            "representativeFaceId": person.representative_face_id,
            "photoCount": len({face.photo_id for face in person_faces}),
            "largestArea": largest_area,
            "faces": [{
                "id": face.id,
                "photoId": face.photo_id,
                "bbox": face.bounding_box,
                "area": area,
                # 대표 얼굴 선정과 같은 계산: centroid와의 코사인 유사도, 크기 기준 통과 여부
                "similarity": round(float(numpy.asarray(face.embedding, dtype=numpy.float64) @ centroid), 4),
                "isCandidate": area >= largest_area * REPRESENTATIVE_MINIMUM_AREA_RATIO,
            } for face, area in zip(person_faces, areas)],
        })

    photo_items = {}
    for index, photo in enumerate(photos, start=1):
        image = read_image(Path(photo.nas_path))
        photo_items[photo.id] = {"name": photo.file_name, "width": image.shape[1], "height": image.shape[0],
                                 "data": encode_thumbnail(image)}
        if index % 100 == 0:
            print(f"  썸네일 {index}/{len(photos)}")

page_data = {"event": event_info, "persons": person_items, "photos": photo_items,
             "minimumAreaRatio": REPRESENTATIVE_MINIMUM_AREA_RATIO}
template = (Path(__file__).parent / "person_folder_page.html").read_text(encoding="utf-8")
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH.write_text(template.replace("__PAGE_DATA__", json.dumps(page_data, ensure_ascii=False)), encoding="utf-8")
print(f"사람 {len(person_items)}명, 사진 {len(photo_items)}장 → {OUTPUT_PATH.relative_to(BACKEND_DIRECTORY)} "
      f"({OUTPUT_PATH.stat().st_size / 1024 / 1024:.1f}MB)")
