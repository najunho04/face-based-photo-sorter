"""보관 테스트: NAS 사진을 Object Storage로 올리고 object_key를 채운 뒤 행사를 open으로 (처리 4).

로컬 DB가 필요함 (backend/에서 docker compose up -d). Object Storage는 moto, NAS는 임시 폴더.
"""

import boto3
import pytest
from moto import mock_aws

from archive.service import archive_and_open_event
from core.error_codes import ApplicationError, ErrorCode
from core.object_storage import ObjectStorage
from database.models import Event, EventStatus, Photo, PhotoStatus

BUCKET = "test-photos"


@pytest.fixture
def s3_client():
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket=BUCKET)
        yield client


@pytest.fixture
def object_storage(s3_client):
    return ObjectStorage(s3_client, BUCKET, presigned_url_expiration_seconds=3600)


def create_event(database_session, status: EventStatus = EventStatus.CLUSTERING) -> Event:
    event = Event(name="보관 테스트", access_code="ARCH01", status=status)
    database_session.add(event)
    database_session.flush()
    return event


def add_photo(database_session, nas_root, event: Event, file_name: str, status: PhotoStatus,
              image_bytes: bytes | None = b"\xff\xd8\xff jpeg", object_key: str | None = None) -> Photo:
    # image_bytes=None이면 NAS에 파일을 만들지 않음 (파일이 사라진 경우)
    nas_path = f"event{event.id}/{file_name}"
    if image_bytes is not None:
        (nas_root / nas_path).parent.mkdir(parents=True, exist_ok=True)
        (nas_root / nas_path).write_bytes(image_bytes)
    photo = Photo(event=event, file_name=file_name, nas_path=nas_path, status=status, object_key=object_key)
    database_session.add(photo)
    database_session.flush()
    return photo


def stored_keys(s3_client) -> list[str]:
    return sorted(item["Key"] for item in s3_client.list_objects_v2(Bucket=BUCKET).get("Contents", []))


def test_archive_uploads_extracted_photos_and_opens_event(database_session, object_storage, s3_client, tmp_path):
    event = create_event(database_session)
    jpeg_photo = add_photo(database_session, tmp_path, event, "IMG_0001.jpg", PhotoStatus.EXTRACTED)
    png_photo = add_photo(database_session, tmp_path, event, "IMG_0002.png", PhotoStatus.EXTRACTED,
                          image_bytes=b"\x89PNG\r\n\x1a\n png")

    result = archive_and_open_event(database_session, event.id, object_storage, tmp_path)

    assert result.archived_count == 2
    assert stored_keys(s3_client) == [f"event{event.id}/IMG_0001.jpg", f"event{event.id}/IMG_0002.png"]
    assert jpeg_photo.object_key == f"event{event.id}/IMG_0001.jpg"
    assert png_photo.object_key == f"event{event.id}/IMG_0002.png"
    # 브라우저가 바로 보여줄 수 있게 형식에 맞는 Content-Type으로 저장
    assert s3_client.get_object(Bucket=BUCKET, Key=png_photo.object_key)["ContentType"] == "image/png"
    assert event.status == EventStatus.OPEN


def test_archive_skips_failed_photos(database_session, object_storage, s3_client, tmp_path):
    # failed(손상·파일 없음)는 참가자에게 보여줄 수 없어서 보관하지 않음
    event = create_event(database_session)
    add_photo(database_session, tmp_path, event, "IMG_0001.jpg", PhotoStatus.EXTRACTED)
    failed_photo = add_photo(database_session, tmp_path, event, "IMG_0013.jpg", PhotoStatus.FAILED)

    result = archive_and_open_event(database_session, event.id, object_storage, tmp_path)

    assert result.archived_count == 1
    assert stored_keys(s3_client) == [f"event{event.id}/IMG_0001.jpg"]
    assert failed_photo.object_key is None


def test_archive_skips_photos_already_archived(database_session, object_storage, s3_client, tmp_path):
    # 중간에 멈춘 뒤 다시 실행해도 남은 사진만 올림 (이미 올린 사진은 다시 올리지 않음)
    event = create_event(database_session)
    add_photo(database_session, tmp_path, event, "IMG_0001.jpg", PhotoStatus.EXTRACTED,
              object_key="already/archived.jpg")
    add_photo(database_session, tmp_path, event, "IMG_0002.jpg", PhotoStatus.EXTRACTED)

    result = archive_and_open_event(database_session, event.id, object_storage, tmp_path)

    assert result.archived_count == 1
    assert stored_keys(s3_client) == [f"event{event.id}/IMG_0002.jpg"]


def test_archive_continues_when_nas_file_is_missing(database_session, object_storage, s3_client, tmp_path):
    # 추출 뒤 NAS 파일이 사라진 사진 1장 때문에 행사 전체가 clustering에 멈추지 않게 함 (건너뛰고 기록)
    event = create_event(database_session)
    missing_photo = add_photo(database_session, tmp_path, event, "IMG_0001.jpg", PhotoStatus.EXTRACTED, image_bytes=None)
    add_photo(database_session, tmp_path, event, "IMG_0002.jpg", PhotoStatus.EXTRACTED)

    result = archive_and_open_event(database_session, event.id, object_storage, tmp_path)

    assert result.archived_count == 1
    assert result.missing_photo_ids == [missing_photo.id]
    assert missing_photo.object_key is None
    assert event.status == EventStatus.OPEN


@pytest.mark.parametrize("status", [EventStatus.UPLOADING, EventStatus.EXTRACTING, EventStatus.OPEN])
def test_archive_only_runs_for_clustering_event(database_session, object_storage, s3_client, tmp_path, status):
    # 분류가 끝난 행사(clustering)만 보관 → open. 다른 상태에서 부르면 아무것도 바꾸지 않음
    event = create_event(database_session, status=status)
    add_photo(database_session, tmp_path, event, "IMG_0001.jpg", PhotoStatus.EXTRACTED)

    with pytest.raises(ApplicationError) as error:
        archive_and_open_event(database_session, event.id, object_storage, tmp_path)

    assert error.value.error_code == ErrorCode.INVALID_STATUS
    assert stored_keys(s3_client) == []
    assert event.status == status


def test_archive_unknown_event_fails(database_session, object_storage, tmp_path):
    with pytest.raises(ApplicationError) as error:
        archive_and_open_event(database_session, 999999999, object_storage, tmp_path)

    assert error.value.error_code == ErrorCode.EVENT_NOT_FOUND
