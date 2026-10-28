# NAS 사진을 Object Storage로 올려 object_key를 채우고, 다 끝나면 행사를 clustering → open으로 바꿈
# 참가자 조회(gallery)는 object_key로 Pre-signed URL을 만들기 때문에, 보관이 끝나야 행사를 공개할 수 있음
import logging
from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.error_codes import ApplicationError, ErrorCode
from core.object_storage import ObjectStorage
from database.models import Event, EventStatus, Photo, PhotoStatus
from event.photo_storage import detect_image_format

logger = logging.getLogger(__name__)

CONTENT_TYPE_BY_IMAGE_FORMAT = {"jpeg": "image/jpeg", "png": "image/png"}


@dataclass
class ArchiveResult:
    archived_count: int = 0
    missing_photo_ids: list[int] = field(default_factory=list)   # NAS에서 파일이 사라져 올리지 못한 사진


def build_object_key(event_id: int, file_name: str) -> str:
    # NAS와 같은 규칙(event{id}/{fileName}) → 두 저장소에서 같은 사진을 찾기 쉬움
    return f"event{event_id}/{file_name}"


def resolve_nas_file(nas_root_path: str | Path, nas_path: str) -> Path:
    # 워커와 같은 규칙: 절대 경로는 그대로, 상대 경로(event1/IMG.jpg)는 NAS 루트 아래
    path = Path(nas_path)
    return path if path.is_absolute() else Path(nas_root_path) / path


def detect_content_type(file_path: Path) -> str:
    # 업로드 때 파일 내용으로 jpg·png만 받았으므로 같은 방식으로 판단 (확장자는 틀릴 수 있음)
    with file_path.open("rb") as image_file:
        image_format = detect_image_format(image_file.read(16))
    return CONTENT_TYPE_BY_IMAGE_FORMAT.get(image_format, "application/octet-stream")


def archive_and_open_event(
    database_session: Session,
    event_id: int,
    object_storage: ObjectStorage,
    nas_root_path: str | Path,
) -> ArchiveResult:
    event = database_session.get(Event, event_id)
    if event is None:
        raise ApplicationError(ErrorCode.EVENT_NOT_FOUND)
    if event.status != EventStatus.CLUSTERING:
        raise ApplicationError(ErrorCode.INVALID_STATUS)   # 분류가 끝난 행사만 공개할 수 있음

    # extracted 사진만 보관 (failed는 손상·파일 없음이라 보여줄 수 없음)
    # object_key가 이미 있는 사진은 건너뜀 → 중간에 멈춰도 다시 부르면 남은 사진만 올림
    photos = database_session.scalars(
        select(Photo)
        .where(Photo.event_id == event.id, Photo.status == PhotoStatus.EXTRACTED, Photo.object_key.is_(None))
        .order_by(Photo.id)
    ).all()

    result = ArchiveResult()
    for photo in photos:
        file_path = resolve_nas_file(nas_root_path, photo.nas_path)
        if not file_path.is_file():
            # 사진 1장 때문에 행사 전체가 clustering에 멈추지 않게 건너뜀. 이 사진은 참가자에게 보이지 않음
            logger.error("NAS에 파일이 없어 보관하지 못함: photo_id=%s, path=%s", photo.id, file_path)
            result.missing_photo_ids.append(photo.id)
            continue
        object_key = build_object_key(event.id, photo.file_name)
        object_storage.upload_file(file_path, object_key, detect_content_type(file_path))
        # 한 장 올릴 때마다 커밋: 업로드 성공과 object_key 기록 사이의 간격을 줄여 재실행 때 다시 올리는 사진을 최소화
        photo.object_key = object_key
        database_session.commit()
        result.archived_count += 1

    event.status = EventStatus.OPEN   # 이제 참가자가 입장해서 사진을 볼 수 있음
    database_session.commit()
    logger.info("보관 완료, 행사 공개: event_id=%s, 보관 %d장, 누락 %d장",
                event.id, result.archived_count, len(result.missing_photo_ids))
    return result
