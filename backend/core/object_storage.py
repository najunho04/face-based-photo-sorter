"""공용 Object Storage 클라이언트 (NCP Object Storage = S3 호환이라 boto3 사용).

- 보관(archive): NAS 사진 업로드
- 조회(gallery)·매칭(matching): 비공개 버킷 사진을 브라우저가 열 수 있게 Pre-signed URL 생성
테스트에서는 moto로 만든 가짜 S3 클라이언트를 넣어서 씀 (NCP 키·네트워크 불필요)
"""

from functools import lru_cache
from pathlib import Path

import boto3
from botocore.config import Config

from core.configuration import get_settings


class ObjectStorage:
    def __init__(self, client, bucket: str, presigned_url_expiration_seconds: int):
        self.client = client
        self.bucket = bucket
        self.presigned_url_expiration_seconds = presigned_url_expiration_seconds

    def upload_file(self, local_path: str | Path, object_key: str, content_type: str) -> None:
        # Content-Type을 같이 저장해야 Pre-signed URL로 열 때 브라우저가 다운로드 대신 이미지로 보여줌
        # upload_file은 큰 파일을 알아서 나눠 올림(멀티파트)
        self.client.upload_file(str(local_path), self.bucket, object_key, ExtraArgs={"ContentType": content_type})

    def create_presigned_url(self, object_key: str) -> str:
        # 버킷은 비공개. 서명된 URL은 만료(기본 3600초) 전까지만 열림 → 링크가 퍼져도 영구 노출되지 않음
        # URL 생성은 서명 계산만 해서 네트워크 요청이 없음 (사진 30장 목록도 빠름)
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": object_key},
            ExpiresIn=self.presigned_url_expiration_seconds,
        )


@lru_cache
def get_object_storage() -> ObjectStorage:
    # 프로세스당 한 번만 만들어 재사용 (boto3 클라이언트는 여러 스레드에서 같이 써도 안전)
    # FastAPI 의존성으로도 씀: 테스트에서는 dependency_overrides로 가짜를 넣음
    settings = get_settings()
    client = boto3.client(
        "s3",
        endpoint_url=settings.object_storage_endpoint,
        region_name=settings.object_storage_region,
        aws_access_key_id=settings.object_storage_access_key,
        aws_secret_access_key=settings.object_storage_secret_key,
        # NCP는 서명 방식 v4 (Pre-signed URL도 같은 방식으로 서명)
        config=Config(signature_version="s3v4"),
    )
    return ObjectStorage(client, settings.object_storage_bucket, settings.presigned_url_expiration_seconds)
