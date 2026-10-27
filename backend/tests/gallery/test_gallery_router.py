"""조회 API 테스트: API 7 전체 사진, API 10 사람 폴더 목록, API 9 사람 폴더 사진 (docs/api.md).

로컬 DB가 필요함 (backend/에서 docker compose up -d). Object Storage는 moto로 만든 가짜 (Pre-signed URL은 서명 계산만 함).
"""

from urllib.parse import parse_qs, urlparse

import boto3
import numpy
import pytest
from botocore.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from moto import mock_aws

from core.object_storage import ObjectStorage, get_object_storage
from core.responses import register_exception_handlers
from core.security import TokenRole, create_access_token
from database.connection import get_database_session
from database.face_contract import EMBEDDING_DIMENSION
from database.models import Event, EventStatus, Face, Person, Photo, PhotoStatus
from gallery.router import router

BUCKET = "test-photos"
EMBEDDING = numpy.eye(1, EMBEDDING_DIMENSION, 0, dtype=numpy.float32)[0]


@pytest.fixture
def object_storage():
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1", config=Config(signature_version="s3v4"))
        client.create_bucket(Bucket=BUCKET)
        yield ObjectStorage(client, BUCKET, presigned_url_expiration_seconds=3600)


@pytest.fixture
def test_client(database_session, object_storage) -> TestClient:
    application = FastAPI()
    register_exception_handlers(application)
    application.include_router(router)
    application.dependency_overrides[get_database_session] = lambda: database_session
    application.dependency_overrides[get_object_storage] = lambda: object_storage
    return TestClient(application, raise_server_exceptions=False)


def participant_headers(event_id: int) -> dict:
    return {"Authorization": f"Bearer {create_access_token(TokenRole.PARTICIPANT, event_id=event_id)[0]}"}


def admin_headers() -> dict:
    return {"Authorization": f"Bearer {create_access_token(TokenRole.ADMIN)[0]}"}


def create_event(database_session, status: EventStatus = EventStatus.OPEN, access_code: str = "GAL001") -> Event:
    event = Event(name="조회 테스트", access_code=access_code, status=status)
    database_session.add(event)
    database_session.flush()
    return event


def add_photo(database_session, event: Event, file_name: str, is_archived: bool = True,
              status: PhotoStatus = PhotoStatus.EXTRACTED) -> Photo:
    # is_archived=False: Object Storage에 올라가지 않은 사진 (failed, 또는 보관 때 NAS 파일이 사라진 사진)
    photo = Photo(event=event, file_name=file_name, nas_path=f"event{event.id}/{file_name}", status=status,
                  object_key=f"event{event.id}/{file_name}" if is_archived else None)
    database_session.add(photo)
    database_session.flush()
    return photo


def add_person(database_session, event: Event, label: str, photos: list[Photo],
               representative_index: int | None = 0) -> Person:
    # photos마다 이 사람 얼굴 1개. 같은 사진을 두 번 넣으면 한 사진에 얼굴 2개
    person = Person(event=event, label=label, centroid=EMBEDDING)
    database_session.add(person)
    database_session.flush()
    faces = [Face(photo_id=photo.id, event_id=event.id, embedding=EMBEDDING, person_id=person.id,
                  bounding_box={"x": 10 + index, "y": 20, "w": 30, "h": 40})
             for index, photo in enumerate(photos)]
    database_session.add_all(faces)
    database_session.flush()
    if representative_index is not None:
        person.representative_face_id = faces[representative_index].id
        database_session.flush()
    return person


def query_of(url: str) -> dict:
    return parse_qs(urlparse(url).query)


# --- API 7 전체 사진 보기 ---

def test_event_photos_returns_page_with_presigned_urls(test_client, database_session):
    event = create_event(database_session)
    photos = [add_photo(database_session, event, f"IMG_{number:04d}.jpg") for number in range(1, 4)]

    response = test_client.get(f"/api/events/{event.id}/photos?page=1&size=2", headers=participant_headers(event.id))

    assert response.status_code == 200
    data = response.json()["data"]
    assert (data["page"], data["size"], data["total"]) == (1, 2, 3)
    assert [photo["photoId"] for photo in data["photos"]] == [photos[0].id, photos[1].id]
    first_photo = data["photos"][0]
    assert first_photo["fileName"] == "IMG_0001.jpg"
    assert first_photo["expiresIn"] == 3600
    assert urlparse(first_photo["url"]).path.endswith(f"/event{event.id}/IMG_0001.jpg")
    assert "X-Amz-Signature" in query_of(first_photo["url"])


def test_event_photos_second_page_and_defaults(test_client, database_session):
    event = create_event(database_session)
    photos = [add_photo(database_session, event, f"IMG_{number:04d}.jpg") for number in range(1, 4)]

    second_page = test_client.get(f"/api/events/{event.id}/photos?page=2&size=2", headers=participant_headers(event.id))
    default_page = test_client.get(f"/api/events/{event.id}/photos", headers=participant_headers(event.id))

    assert [photo["photoId"] for photo in second_page.json()["data"]["photos"]] == [photos[2].id]
    # 명세 기본값 page=1, size=30
    assert (default_page.json()["data"]["page"], default_page.json()["data"]["size"]) == (1, 30)
    assert len(default_page.json()["data"]["photos"]) == 3


def test_event_photos_excludes_photos_not_in_object_storage(test_client, database_session):
    # URL을 만들 수 없는 사진(failed, 보관 누락)은 목록과 total에서 뺌
    event = create_event(database_session)
    archived_photo = add_photo(database_session, event, "IMG_0001.jpg")
    add_photo(database_session, event, "IMG_0002.jpg", is_archived=False, status=PhotoStatus.FAILED)
    add_photo(database_session, event, "IMG_0003.jpg", is_archived=False)

    data = test_client.get(f"/api/events/{event.id}/photos", headers=participant_headers(event.id)).json()["data"]

    assert data["total"] == 1
    assert [photo["photoId"] for photo in data["photos"]] == [archived_photo.id]


@pytest.mark.parametrize("query", ["page=0", "size=0", "size=101", "page=abc"])
def test_event_photos_rejects_invalid_paging(test_client, database_session, query):
    event = create_event(database_session)

    response = test_client.get(f"/api/events/{event.id}/photos?{query}", headers=participant_headers(event.id))

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_event_photos_requires_participant_of_this_event(test_client, database_session):
    event = create_event(database_session)

    no_token = test_client.get(f"/api/events/{event.id}/photos")
    other_event_token = test_client.get(f"/api/events/{event.id}/photos", headers=participant_headers(event.id + 1))

    assert (no_token.status_code, no_token.json()["error"]["code"]) == (401, "UNAUTHORIZED")
    assert (other_event_token.status_code, other_event_token.json()["error"]["code"]) == (403, "FORBIDDEN")


def test_event_photos_before_open_is_not_ready(test_client, database_session):
    event = create_event(database_session, status=EventStatus.CLUSTERING)

    response = test_client.get(f"/api/events/{event.id}/photos", headers=participant_headers(event.id))

    assert (response.status_code, response.json()["error"]["code"]) == (409, "EVENT_NOT_READY")


def test_event_photos_unknown_event(test_client):
    response = test_client.get("/api/events/999999999/photos", headers=participant_headers(999999999))

    assert (response.status_code, response.json()["error"]["code"]) == (404, "EVENT_NOT_FOUND")


# --- API 10 사람 폴더 목록 ---

def test_persons_are_sorted_by_photo_count_with_representative_face(test_client, database_session):
    event = create_event(database_session)
    photos = [add_photo(database_session, event, f"IMG_{number:04d}.jpg") for number in range(1, 4)]
    few_person = add_person(database_session, event, "user2", photos[:1])
    many_person = add_person(database_session, event, "user1", photos, representative_index=1)

    response = test_client.get(f"/api/events/{event.id}/persons", headers=participant_headers(event.id))

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 2
    assert [(person["personId"], person["label"], person["photoCount"]) for person in data["persons"]] == [
        (many_person.id, "user1", 3), (few_person.id, "user2", 1),
    ]
    # 대표 얼굴: 그 얼굴이 있는 원본 사진 URL + 얼굴 위치 → 프론트가 CSS로 잘라 보여줌
    representative_face = data["persons"][0]["repFace"]
    assert urlparse(representative_face["url"]).path.endswith(f"/event{event.id}/IMG_0002.jpg")
    assert representative_face["bbox"] == {"x": 11, "y": 20, "w": 30, "h": 40}


def test_persons_min_photos_hides_people_seen_once(test_client, database_session):
    event = create_event(database_session)
    photos = [add_photo(database_session, event, f"IMG_{number:04d}.jpg") for number in range(1, 3)]
    add_person(database_session, event, "user1", photos)
    add_person(database_session, event, "user2", photos[:1])   # 배경에 한 번 찍힌 사람

    data = test_client.get(f"/api/events/{event.id}/persons?minPhotos=2", headers=participant_headers(event.id)).json()["data"]

    assert data["total"] == 1
    assert [person["label"] for person in data["persons"]] == ["user1"]


def test_persons_photo_count_counts_distinct_archived_photos(test_client, database_session):
    # 한 사진에 같은 사람 얼굴이 두 번 잡혀도 1장, 보관되지 않은 사진은 폴더에서 열 수 없으니 세지 않음
    event = create_event(database_session)
    photo = add_photo(database_session, event, "IMG_0001.jpg")
    missing_photo = add_photo(database_session, event, "IMG_0002.jpg", is_archived=False)
    add_person(database_session, event, "user1", [photo, photo, missing_photo])

    [person] = test_client.get(f"/api/events/{event.id}/persons", headers=participant_headers(event.id)).json()["data"]["persons"]

    assert person["photoCount"] == 1


def test_persons_without_viewable_representative_face_has_null_rep_face(test_client, database_session):
    # 대표 얼굴 사진이 보관되지 않았거나 대표 얼굴이 없으면 repFace=null (프론트는 기본 아이콘)
    event = create_event(database_session)
    photo = add_photo(database_session, event, "IMG_0001.jpg")
    missing_photo = add_photo(database_session, event, "IMG_0002.jpg", is_archived=False)
    add_person(database_session, event, "user1", [missing_photo, photo], representative_index=0)
    add_person(database_session, event, "user2", [photo], representative_index=None)

    persons = test_client.get(f"/api/events/{event.id}/persons", headers=participant_headers(event.id)).json()["data"]["persons"]

    assert [person["repFace"] for person in persons] == [None, None]


def test_persons_only_of_this_event(test_client, database_session):
    event = create_event(database_session)
    other_event = create_event(database_session, access_code="GAL002")
    add_person(database_session, other_event, "user1", [add_photo(database_session, other_event, "IMG_0001.jpg")])

    data = test_client.get(f"/api/events/{event.id}/persons", headers=participant_headers(event.id)).json()["data"]

    assert data == {"total": 0, "persons": []}


def test_persons_admin_can_view_any_event_participant_only_own(test_client, database_session):
    event = create_event(database_session)

    admin_response = test_client.get(f"/api/events/{event.id}/persons", headers=admin_headers())
    other_participant = test_client.get(f"/api/events/{event.id}/persons", headers=participant_headers(event.id + 1))

    assert admin_response.status_code == 200
    assert (other_participant.status_code, other_participant.json()["error"]["code"]) == (403, "FORBIDDEN")


def test_persons_rejects_min_photos_below_one(test_client, database_session):
    event = create_event(database_session)

    response = test_client.get(f"/api/events/{event.id}/persons?minPhotos=0", headers=admin_headers())

    assert (response.status_code, response.json()["error"]["code"]) == (400, "INVALID_REQUEST")


def test_persons_before_open_is_not_ready(test_client, database_session):
    event = create_event(database_session, status=EventStatus.CLUSTERING)

    response = test_client.get(f"/api/events/{event.id}/persons", headers=admin_headers())

    assert (response.status_code, response.json()["error"]["code"]) == (409, "EVENT_NOT_READY")


# --- API 9 사람 폴더 사진 ---

def test_person_photos_returns_view_and_download_urls(test_client, database_session):
    event = create_event(database_session)
    photos = [add_photo(database_session, event, f"IMG_{number:04d}.jpg") for number in range(1, 4)]
    person = add_person(database_session, event, "user1", [photos[2], photos[0], photos[0]])

    response = test_client.get(f"/api/events/{event.id}/persons/{person.id}/photos", headers=participant_headers(event.id))

    assert response.status_code == 200
    data = response.json()["data"]
    assert (data["personId"], data["label"], data["total"]) == (person.id, "user1", 2)
    # 사진 id 순서, 한 사진에 얼굴이 두 번 있어도 한 번만
    assert [photo["photoId"] for photo in data["photos"]] == [photos[0].id, photos[2].id]
    first_photo = data["photos"][0]
    assert first_photo["fileName"] == "IMG_0001.jpg"
    assert first_photo["expiresIn"] == 3600
    assert "response-content-disposition" not in query_of(first_photo["url"])
    assert query_of(first_photo["downloadUrl"])["response-content-disposition"] == ["attachment; filename*=UTF-8''IMG_0001.jpg"]


def test_person_photos_excludes_photos_not_in_object_storage(test_client, database_session):
    event = create_event(database_session)
    photo = add_photo(database_session, event, "IMG_0001.jpg")
    person = add_person(database_session, event, "user1", [photo, add_photo(database_session, event, "IMG_0002.jpg", is_archived=False)])

    data = test_client.get(f"/api/events/{event.id}/persons/{person.id}/photos", headers=admin_headers()).json()["data"]

    assert data["total"] == 1
    assert [item["photoId"] for item in data["photos"]] == [photo.id]


def test_person_photos_person_of_other_event_is_not_found(test_client, database_session):
    # 경로의 행사에 속하지 않은 사람은 없는 사람으로 취급 (다른 행사 사진 유출 방지)
    event = create_event(database_session)
    other_event = create_event(database_session, access_code="GAL002")
    other_person = add_person(database_session, other_event, "user1", [add_photo(database_session, other_event, "IMG_0001.jpg")])

    other_person_response = test_client.get(f"/api/events/{event.id}/persons/{other_person.id}/photos",
                                            headers=participant_headers(event.id))
    unknown_response = test_client.get(f"/api/events/{event.id}/persons/999999999/photos", headers=participant_headers(event.id))

    assert (other_person_response.status_code, other_person_response.json()["error"]["code"]) == (404, "PERSON_NOT_FOUND")
    assert (unknown_response.status_code, unknown_response.json()["error"]["code"]) == (404, "PERSON_NOT_FOUND")


def test_person_photos_before_open_is_not_ready(test_client, database_session):
    event = create_event(database_session, status=EventStatus.CLUSTERING)
    person = add_person(database_session, event, "user1", [add_photo(database_session, event, "IMG_0001.jpg")])

    response = test_client.get(f"/api/events/{event.id}/persons/{person.id}/photos", headers=admin_headers())

    assert (response.status_code, response.json()["error"]["code"]) == (409, "EVENT_NOT_READY")


def test_person_photos_requires_token_of_this_event(test_client, database_session):
    event = create_event(database_session)
    person = add_person(database_session, event, "user1", [add_photo(database_session, event, "IMG_0001.jpg")])

    response = test_client.get(f"/api/events/{event.id}/persons/{person.id}/photos", headers=participant_headers(event.id + 1))

    assert (response.status_code, response.json()["error"]["code"]) == (403, "FORBIDDEN")
