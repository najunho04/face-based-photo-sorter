"""셀카 매칭 API 테스트: POST /api/events/{event_id}/match (docs/api.md 8번).

HTTP 부분만 검증: 참가자 토큰, 파일 형식·용량, 공통 응답 형식, camelCase, 점수 비노출.
로컬 DB가 필요함. 실제 InsightFace와 Object Storage 대신 가짜를 의존성 교체(dependency_overrides)로 넣음.
"""

import cv2
import numpy
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.responses import register_exception_handlers
from core.security import TokenRole, create_access_token
from database.connection import get_database_session
from database.face_contract import EMBEDDING_DIMENSION
from database.models import Event, EventStatus, Face, Person, Photo
from extraction.face_analyzer import DetectedFace
from matching.router import MAXIMUM_SELFIE_BYTES, get_face_analyzer, get_photo_url_builder, router

SELFIE_EMBEDDING = numpy.eye(1, EMBEDDING_DIMENSION, 0, dtype=numpy.float32)[0]


class FakeFaceAnalyzer:
    def __init__(self, detected_faces):
        self.detected_faces = detected_faces

    def analyze(self, image):
        return self.detected_faces


def build_test_client(database_session, face_analyzer) -> TestClient:
    # 실제 앱(main)은 아직 없어서, 공통 예외 처리 + 매칭 라우터만 붙인 최소 앱으로 검증
    application = FastAPI()
    register_exception_handlers(application)
    application.include_router(router)
    application.dependency_overrides[get_database_session] = lambda: database_session
    application.dependency_overrides[get_face_analyzer] = lambda: face_analyzer
    application.dependency_overrides[get_photo_url_builder] = lambda: (lambda photo: f"https://example.com/photos/{photo.id}")
    return TestClient(application, raise_server_exceptions=False)


def participant_headers(event_id: int) -> dict:
    access_token, _ = create_access_token(TokenRole.PARTICIPANT, event_id=event_id)
    return {"Authorization": f"Bearer {access_token}"}


def png_bytes() -> bytes:
    return cv2.imencode(".png", numpy.full((60, 60, 3), 128, dtype=numpy.uint8))[1].tobytes()


def create_open_event_with_person(database_session) -> tuple[Event, Person, Photo]:
    event = Event(name="매칭 API 테스트", access_code="ROUTER1", status=EventStatus.OPEN)
    database_session.add(event)
    database_session.flush()
    photo = Photo(event=event, file_name="IMG_0001.jpg", nas_path=f"event{event.id}/IMG_0001.jpg")
    database_session.add(photo)
    database_session.flush()
    person = Person(event=event, label="user1", centroid=SELFIE_EMBEDDING)
    database_session.add(person)
    database_session.flush()
    face = Face(photo_id=photo.id, event_id=event.id, bounding_box={"x": 120, "y": 80, "w": 96, "h": 96},
                embedding=SELFIE_EMBEDDING, person_id=person.id)
    database_session.add(face)
    database_session.flush()
    person.representative_face_id = face.id
    database_session.flush()
    return event, person, photo


def matching_face() -> DetectedFace:
    return DetectedFace(bounding_box={"x": 0, "y": 0, "w": 200, "h": 200}, embedding=SELFIE_EMBEDDING, detection_score=0.9)


def test_match_returns_candidates_in_api_shape(database_session):
    event, person, photo = create_open_event_with_person(database_session)
    test_client = build_test_client(database_session, FakeFaceAnalyzer([matching_face()]))

    response = test_client.post(
        f"/api/events/{event.id}/match",
        headers=participant_headers(event.id),
        files={"selfie": ("selfie.png", png_bytes(), "image/png")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True and body["error"] is None
    # docs/api.md 8번 모양 그대로 (camelCase), 유사도 점수는 응답에 없음
    assert body["data"] == {"candidates": [{
        "personId": person.id,
        "label": "user1",
        "photoCount": 1,
        "repFace": {"url": f"https://example.com/photos/{photo.id}", "bbox": {"x": 120, "y": 80, "w": 96, "h": 96}},
    }]}


def test_match_without_token_is_unauthorized(database_session):
    event, _, _ = create_open_event_with_person(database_session)
    test_client = build_test_client(database_session, FakeFaceAnalyzer([matching_face()]))

    response = test_client.post(f"/api/events/{event.id}/match", files={"selfie": ("selfie.png", png_bytes(), "image/png")})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_match_with_token_of_another_event_is_forbidden(database_session):
    # 다른 행사의 참가자 토큰으로는 이 행사의 사람 폴더를 볼 수 없음
    event, _, _ = create_open_event_with_person(database_session)
    test_client = build_test_client(database_session, FakeFaceAnalyzer([matching_face()]))

    response = test_client.post(
        f"/api/events/{event.id}/match",
        headers=participant_headers(event.id + 1),
        files={"selfie": ("selfie.png", png_bytes(), "image/png")},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_match_rejects_file_that_is_not_jpg_or_png(database_session):
    event, _, _ = create_open_event_with_person(database_session)
    test_client = build_test_client(database_session, FakeFaceAnalyzer([matching_face()]))

    response = test_client.post(
        f"/api/events/{event.id}/match",
        headers=participant_headers(event.id),
        files={"selfie": ("selfie.heic", b"heic data", "image/heic")},
    )

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "UNSUPPORTED_FILE"


def test_match_rejects_file_that_is_too_large(database_session):
    event, _, _ = create_open_event_with_person(database_session)
    test_client = build_test_client(database_session, FakeFaceAnalyzer([matching_face()]))
    too_large_bytes = b"0" * (MAXIMUM_SELFIE_BYTES + 1)

    response = test_client.post(
        f"/api/events/{event.id}/match",
        headers=participant_headers(event.id),
        files={"selfie": ("selfie.jpg", too_large_bytes, "image/jpeg")},
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_match_without_selfie_field_is_invalid_request(database_session):
    event, _, _ = create_open_event_with_person(database_session)
    test_client = build_test_client(database_session, FakeFaceAnalyzer([matching_face()]))

    response = test_client.post(f"/api/events/{event.id}/match", headers=participant_headers(event.id))

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_match_without_face_returns_face_not_detected(database_session):
    event, _, _ = create_open_event_with_person(database_session)
    test_client = build_test_client(database_session, FakeFaceAnalyzer([]))

    response = test_client.post(
        f"/api/events/{event.id}/match",
        headers=participant_headers(event.id),
        files={"selfie": ("selfie.png", png_bytes(), "image/png")},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "FACE_NOT_DETECTED"
