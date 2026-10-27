"""관리자 행사 API 테스트: API 2 행사 생성, 3 사진 업로드, 4 업로드 완료, 5 진행 상황.

로컬 DB가 필요함 (backend/에서 docker compose up -d). NAS는 임시 폴더로 바꿔서 테스트.
"""

import re

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

import event.service
from core.configuration import get_settings
from core.responses import register_exception_handlers
from core.security import TokenRole, create_access_token
from database.connection import get_database_session
from database.face_contract import EMBEDDING_DIMENSION
from database.models import Event, EventStatus, Person, Photo, PhotoStatus
from event.router import MAXIMUM_PHOTO_BYTES, router

JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"jpeg body"
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"png body"


@pytest.fixture
def nas_root(tmp_path, monkeypatch):
    # 실제 backend/nas 대신 테스트마다 새 임시 폴더에 저장
    monkeypatch.setenv("NAS_ROOT_PATH", str(tmp_path))
    get_settings.cache_clear()
    return tmp_path


def build_test_client(database_session) -> TestClient:
    application = FastAPI()
    register_exception_handlers(application)
    application.include_router(router)
    application.dependency_overrides[get_database_session] = lambda: database_session
    return TestClient(application, raise_server_exceptions=False)


def admin_headers() -> dict:
    return {"Authorization": f"Bearer {create_access_token(TokenRole.ADMIN)[0]}"}


def create_event(database_session, status: EventStatus = EventStatus.UPLOADING, access_code: str = "EVT001") -> Event:
    created_event = Event(name="2026 가을 축제", access_code=access_code, status=status)
    database_session.add(created_event)
    database_session.flush()
    return created_event


def add_photo(database_session, target_event: Event, file_name: str, status: PhotoStatus) -> Photo:
    photo = Photo(event=target_event, file_name=file_name, nas_path=f"event{target_event.id}/{file_name}", status=status)
    database_session.add(photo)
    database_session.flush()
    return photo


# --- 공통: 관리자 전용 ---

def test_event_api_without_token_is_unauthorized(database_session):
    response = build_test_client(database_session).post("/api/admin/events", json={"name": "축제"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_event_api_with_participant_token_is_forbidden(database_session):
    participant_token = create_access_token(TokenRole.PARTICIPANT, event_id=1)[0]

    response = build_test_client(database_session).post(
        "/api/admin/events", json={"name": "축제"}, headers={"Authorization": f"Bearer {participant_token}"}
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


# --- API 2 행사 생성 ---

def test_create_event_returns_six_character_access_code(database_session):
    response = build_test_client(database_session).post(
        "/api/admin/events", json={"name": "2026 가을 축제"}, headers=admin_headers()
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["name"] == "2026 가을 축제"
    assert data["status"] == "uploading"
    # 명세 예시(A7K2Q9)처럼 대문자·숫자 6자리 → 입장 API의 정규화 결과와 그대로 일치
    assert re.fullmatch(r"[A-Z0-9]{6}", data["accessCode"])
    saved_event = database_session.get(Event, data["eventId"])
    assert saved_event.access_code == data["accessCode"]


def test_create_event_retries_when_access_code_already_exists(database_session, monkeypatch):
    # 이미 쓰는 코드가 나오면 다시 뽑음 (인증코드는 행사끼리 겹치면 안 됨)
    create_event(database_session, access_code="TAKEN1")
    generated_codes = iter(["TAKEN1", "FRESH1"])
    monkeypatch.setattr(event.service, "generate_access_code", lambda: next(generated_codes))

    response = build_test_client(database_session).post(
        "/api/admin/events", json={"name": "두 번째 행사"}, headers=admin_headers()
    )

    assert response.status_code == 200
    assert response.json()["data"]["accessCode"] == "FRESH1"


@pytest.mark.parametrize("request_body", [{}, {"name": ""}, {"name": "   "}, {"name": "가" * 101}])
def test_create_event_with_invalid_name_is_invalid_request(database_session, request_body):
    response = build_test_client(database_session).post("/api/admin/events", json=request_body, headers=admin_headers())

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


# --- API 3 사진 업로드 ---

def test_upload_saves_files_to_nas_and_creates_uploaded_photos(database_session, nas_root):
    target_event = create_event(database_session)

    response = build_test_client(database_session).post(
        f"/api/admin/events/{target_event.id}/photos",
        headers=admin_headers(),
        files=[("files", ("IMG_0001.jpg", JPEG_BYTES, "image/jpeg")), ("files", ("IMG_0002.png", PNG_BYTES, "image/png"))],
    )

    assert response.status_code == 200
    assert response.json()["data"] == {"uploaded": 2, "failed": []}
    photos = database_session.scalars(select(Photo).where(Photo.event_id == target_event.id).order_by(Photo.id)).all()
    # 워커가 가져갈 수 있게 uploaded 상태, NAS 루트 기준 상대 경로
    assert [(photo.file_name, photo.nas_path, photo.status) for photo in photos] == [
        ("IMG_0001.jpg", f"event{target_event.id}/IMG_0001.jpg", PhotoStatus.UPLOADED),
        ("IMG_0002.png", f"event{target_event.id}/IMG_0002.png", PhotoStatus.UPLOADED),
    ]
    assert (nas_root / f"event{target_event.id}" / "IMG_0001.jpg").read_bytes() == JPEG_BYTES


def test_upload_reports_bad_files_and_keeps_good_ones(database_session, nas_root):
    # 명세: 파일 단위 실패는 failed에 담고 나머지는 성공 처리
    target_event = create_event(database_session)
    too_large_bytes = JPEG_BYTES + b"0" * MAXIMUM_PHOTO_BYTES

    response = build_test_client(database_session).post(
        f"/api/admin/events/{target_event.id}/photos",
        headers=admin_headers(),
        files=[
            ("files", ("IMG_0001.jpg", JPEG_BYTES, "image/jpeg")),
            ("files", ("IMG_0013.heic", b"heic data", "image/heic")),
            ("files", ("fake.jpg", b"not an image", "image/jpeg")),   # 확장자만 jpg
            ("files", ("IMG_0099.jpg", too_large_bytes, "image/jpeg")),
        ],
    )

    assert response.status_code == 200
    assert response.json()["data"] == {"uploaded": 1, "failed": [
        {"fileName": "IMG_0013.heic", "reason": "UNSUPPORTED_FILE"},
        {"fileName": "fake.jpg", "reason": "UNSUPPORTED_FILE"},
        {"fileName": "IMG_0099.jpg", "reason": "FILE_TOO_LARGE"},
    ]}
    assert len(database_session.scalars(select(Photo).where(Photo.event_id == target_event.id)).all()) == 1
    assert not (nas_root / f"event{target_event.id}" / "IMG_0099.jpg").exists()


def upload(test_client, event_id: int, files: list[tuple[str, bytes]]):
    return test_client.post(
        f"/api/admin/events/{event_id}/photos",
        headers=admin_headers(),
        files=[("files", (file_name, image_bytes, "image/jpeg")) for file_name, image_bytes in files],
    )


def event_photos(database_session, target_event: Event) -> list[Photo]:
    return database_session.scalars(select(Photo).where(Photo.event_id == target_event.id).order_by(Photo.id)).all()


def test_reupload_of_same_file_name_overwrites_file_without_adding_row(database_session, nas_root):
    # 업로드 재시도(시간 초과 등)로 같은 이름이 다시 와도 photos 행은 1개 → 같은 사진이 두 번 분류되지 않음
    target_event = create_event(database_session)
    test_client = build_test_client(database_session)

    first_response = upload(test_client, target_event.id, [("IMG_0001.jpg", JPEG_BYTES)])
    second_response = upload(test_client, target_event.id, [("IMG_0001.jpg", PNG_BYTES)])

    # 프론트 입장에서는 두 번 다 올라간 것 (재시도가 실패로 보이면 안 됨)
    assert first_response.json()["data"] == {"uploaded": 1, "failed": []}
    assert second_response.json()["data"] == {"uploaded": 1, "failed": []}
    assert len(event_photos(database_session, target_event)) == 1
    assert (nas_root / f"event{target_event.id}" / "IMG_0001.jpg").read_bytes() == PNG_BYTES


def test_same_file_name_twice_in_one_request_adds_one_row(database_session, nas_root):
    target_event = create_event(database_session)

    response = upload(build_test_client(database_session), target_event.id,
                      [("IMG_0001.jpg", JPEG_BYTES), ("IMG_0001.jpg", JPEG_BYTES)])

    assert response.json()["data"]["uploaded"] == 2
    assert len(event_photos(database_session, target_event)) == 1


def test_reupload_keeps_photo_that_worker_already_processed(database_session, nas_root):
    # 이미 추출된 사진은 같은 사진이므로 다시 처리하지 않음 (상태·얼굴 그대로)
    target_event = create_event(database_session)
    extracted_photo = add_photo(database_session, target_event, "IMG_0001.jpg", PhotoStatus.EXTRACTED)

    upload(build_test_client(database_session), target_event.id, [("IMG_0001.jpg", JPEG_BYTES)])

    database_session.refresh(extracted_photo)
    assert extracted_photo.status == PhotoStatus.EXTRACTED
    assert len(event_photos(database_session, target_event)) == 1


def test_reupload_of_failed_photo_queues_it_again(database_session, nas_root):
    # failed(손상 파일 등)였던 사진을 다시 올리면 새 파일로 다시 처리하도록 uploaded로 되돌림
    target_event = create_event(database_session)
    failed_photo = add_photo(database_session, target_event, "IMG_0001.jpg", PhotoStatus.FAILED)
    failed_photo.worker_id = "worker-1"
    database_session.flush()

    upload(build_test_client(database_session), target_event.id, [("IMG_0001.jpg", JPEG_BYTES)])

    database_session.refresh(failed_photo)
    assert failed_photo.status == PhotoStatus.UPLOADED
    assert failed_photo.worker_id is None
    assert failed_photo.claimed_at is None
    assert len(event_photos(database_session, target_event)) == 1


def test_same_file_name_in_different_events_is_separate_photo(database_session, nas_root):
    first_event = create_event(database_session, access_code="EVT001")
    second_event = create_event(database_session, access_code="EVT002")
    test_client = build_test_client(database_session)

    upload(test_client, first_event.id, [("IMG_0001.jpg", JPEG_BYTES)])
    upload(test_client, second_event.id, [("IMG_0001.jpg", JPEG_BYTES)])

    assert len(event_photos(database_session, first_event)) == 1
    assert len(event_photos(database_session, second_event)) == 1


def test_upload_to_unknown_event_fails(database_session, nas_root):
    response = build_test_client(database_session).post(
        "/api/admin/events/999999999/photos", headers=admin_headers(),
        files=[("files", ("IMG_0001.jpg", JPEG_BYTES, "image/jpeg"))],
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "EVENT_NOT_FOUND"


def test_upload_after_upload_complete_is_invalid_status(database_session, nas_root):
    target_event = create_event(database_session, status=EventStatus.EXTRACTING)

    response = build_test_client(database_session).post(
        f"/api/admin/events/{target_event.id}/photos", headers=admin_headers(),
        files=[("files", ("IMG_0001.jpg", JPEG_BYTES, "image/jpeg"))],
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_STATUS"


def test_upload_without_files_is_invalid_request(database_session, nas_root):
    target_event = create_event(database_session)

    response = build_test_client(database_session).post(f"/api/admin/events/{target_event.id}/photos", headers=admin_headers())

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


# --- API 4 업로드 완료 ---

def test_upload_complete_moves_event_to_extracting(database_session):
    target_event = create_event(database_session)
    add_photo(database_session, target_event, "IMG_0001.jpg", PhotoStatus.UPLOADED)
    add_photo(database_session, target_event, "IMG_0002.jpg", PhotoStatus.EXTRACTED)

    response = build_test_client(database_session).post(
        f"/api/admin/events/{target_event.id}/upload-complete", headers=admin_headers()
    )

    assert response.status_code == 200
    assert response.json()["data"] == {"eventId": target_event.id, "status": "extracting", "totalPhotos": 2}
    database_session.refresh(target_event)
    assert target_event.status == EventStatus.EXTRACTING


def test_upload_complete_twice_is_invalid_status(database_session):
    target_event = create_event(database_session, status=EventStatus.EXTRACTING)
    add_photo(database_session, target_event, "IMG_0001.jpg", PhotoStatus.UPLOADED)

    response = build_test_client(database_session).post(
        f"/api/admin/events/{target_event.id}/upload-complete", headers=admin_headers()
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_STATUS"


def test_upload_complete_without_photos_is_invalid_status(database_session):
    # 사진 0장이면 분류할 것이 없어 extracting에서 멈추므로 거절
    target_event = create_event(database_session)

    response = build_test_client(database_session).post(
        f"/api/admin/events/{target_event.id}/upload-complete", headers=admin_headers()
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_STATUS"
    database_session.refresh(target_event)
    assert target_event.status == EventStatus.UPLOADING


def test_upload_complete_for_unknown_event_fails(database_session):
    response = build_test_client(database_session).post("/api/admin/events/999999999/upload-complete", headers=admin_headers())

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "EVENT_NOT_FOUND"


# --- API 5 진행 상황 ---

def test_event_progress_counts_photos_by_status(database_session):
    target_event = create_event(database_session, status=EventStatus.EXTRACTING)
    add_photo(database_session, target_event, "IMG_0001.jpg", PhotoStatus.UPLOADED)
    add_photo(database_session, target_event, "IMG_0002.jpg", PhotoStatus.PROCESSING)
    add_photo(database_session, target_event, "IMG_0003.jpg", PhotoStatus.EXTRACTED)
    add_photo(database_session, target_event, "IMG_0004.jpg", PhotoStatus.EXTRACTED)
    failed_photo = add_photo(database_session, target_event, "IMG_0013.jpg", PhotoStatus.FAILED)

    response = build_test_client(database_session).get(f"/api/admin/events/{target_event.id}", headers=admin_headers())

    assert response.status_code == 200
    assert response.json()["data"] == {
        "eventId": target_event.id,
        "name": "2026 가을 축제",
        "accessCode": "EVT001",
        "status": "extracting",
        "photos": {"total": 5, "extracted": 2, "processing": 1, "failed": 1},
        "personCount": None,   # 분류가 끝나기(open) 전에는 null
        "failedPhotos": [{"photoId": failed_photo.id, "fileName": "IMG_0013.jpg"}],
    }


def test_event_progress_shows_person_count_after_open(database_session):
    target_event = create_event(database_session, status=EventStatus.OPEN)
    add_photo(database_session, target_event, "IMG_0001.jpg", PhotoStatus.EXTRACTED)
    for label in ["user1", "user2"]:
        database_session.add(Person(event=target_event, label=label, centroid=[1.0] + [0.0] * (EMBEDDING_DIMENSION - 1)))
    database_session.flush()

    response = build_test_client(database_session).get(f"/api/admin/events/{target_event.id}", headers=admin_headers())

    data = response.json()["data"]
    assert data["personCount"] == 2
    assert data["photos"] == {"total": 1, "extracted": 1, "processing": 0, "failed": 0}
    assert data["failedPhotos"] == []


def test_event_progress_for_unknown_event_fails(database_session):
    response = build_test_client(database_session).get("/api/admin/events/999999999", headers=admin_headers())

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "EVENT_NOT_FOUND"
