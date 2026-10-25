"""공용 Object Storage 클라이언트 테스트 (moto로 S3를 메모리에서 흉내, NCP 키·네트워크 불필요)."""

from urllib.parse import parse_qs, urlparse

import boto3
import pytest
from botocore.config import Config
from moto import mock_aws

from core.object_storage import ObjectStorage, get_object_storage

BUCKET = "test-photos"


@pytest.fixture
def s3_client():
    with mock_aws():
        # 운영(get_object_storage)과 같은 서명 방식 v4
        client = boto3.client("s3", region_name="us-east-1", config=Config(signature_version="s3v4"))
        client.create_bucket(Bucket=BUCKET)
        yield client


def test_upload_file_puts_object_with_content_type(s3_client, tmp_path):
    local_path = tmp_path / "IMG_0001.jpg"
    local_path.write_bytes(b"\xff\xd8\xff jpeg")
    object_storage = ObjectStorage(s3_client, BUCKET, presigned_url_expiration_seconds=3600)

    object_storage.upload_file(local_path, "event1/IMG_0001.jpg", content_type="image/jpeg")

    stored_object = s3_client.get_object(Bucket=BUCKET, Key="event1/IMG_0001.jpg")
    assert stored_object["Body"].read() == b"\xff\xd8\xff jpeg"
    assert stored_object["ContentType"] == "image/jpeg"


def test_create_presigned_url_points_to_object_and_expires(s3_client):
    object_storage = ObjectStorage(s3_client, BUCKET, presigned_url_expiration_seconds=3600)

    presigned_url = urlparse(object_storage.create_presigned_url("event1/IMG_0001.jpg"))

    # 버킷은 비공개, URL에 서명과 만료(명세: 3600초)가 들어 있어야 브라우저가 열 수 있음
    assert presigned_url.path.endswith("/event1/IMG_0001.jpg")
    query = parse_qs(presigned_url.query)
    assert query["X-Amz-Expires"] == ["3600"]
    assert "X-Amz-Signature" in query


def test_create_presigned_download_url_asks_browser_to_save_file(s3_client):
    # API 9 downloadUrl: 열면 화면에 띄우지 않고 원래 파일 이름으로 저장 (한글 이름도 깨지지 않게 UTF-8 인코딩)
    object_storage = ObjectStorage(s3_client, BUCKET, presigned_url_expiration_seconds=3600)

    download_url = urlparse(object_storage.create_presigned_download_url("event1/가을_01.jpg", "가을_01.jpg"))

    query = parse_qs(download_url.query)
    assert query["response-content-disposition"] == ["attachment; filename*=UTF-8''%EA%B0%80%EC%9D%84_01.jpg"]
    assert query["X-Amz-Expires"] == ["3600"]
    assert "X-Amz-Signature" in query


def test_get_object_storage_reads_settings(monkeypatch):
    # 실제 연결 없이 설정값(.env)이 클라이언트에 들어가는지만 확인
    from core.configuration import get_settings

    monkeypatch.setenv("OBJECT_STORAGE_ENDPOINT", "https://kr.object.ncloudstorage.com")
    monkeypatch.setenv("OBJECT_STORAGE_BUCKET", "photo-bucket")
    monkeypatch.setenv("OBJECT_STORAGE_ACCESS_KEY", "test-access-key")
    monkeypatch.setenv("OBJECT_STORAGE_SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("PRESIGNED_URL_EXPIRATION_SECONDS", "1800")
    get_settings.cache_clear()
    get_object_storage.cache_clear()

    object_storage = get_object_storage()

    assert object_storage.bucket == "photo-bucket"
    assert object_storage.presigned_url_expiration_seconds == 1800
    assert object_storage.client.meta.endpoint_url == "https://kr.object.ncloudstorage.com"
    get_object_storage.cache_clear()
