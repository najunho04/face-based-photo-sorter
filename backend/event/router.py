# 관리자 행사 API: docs/api.md 2~5번. 모두 관리자 토큰 필요
# 여기서는 HTTP만 담당: 요청 검사, 업로드 파일 읽기, 응답 모양. 처리 순서와 상태 규칙은 service.py
from typing import Annotated

from fastapi import APIRouter, Depends, File
from fastapi import UploadFile
from pydantic import StringConstraints
from sqlalchemy.orm import Session

from core.configuration import get_settings
from core.dependencies import require_admin
from core.responses import CamelCaseModel, success_response
from database.connection import get_database_session
from database.models import EventStatus, PhotoStatus
from event.service import ReceivedPhotoFile, complete_upload, create_event, get_event_progress, upload_photos

# 라우터 전체에 관리자 확인을 걸어서, 새 API를 추가해도 빠뜨리지 않게 함
router = APIRouter(tags=["event"], dependencies=[Depends(require_admin)])

MAXIMUM_PHOTO_BYTES = 20 * 1024 * 1024   # 사진 1장 20MB (프론트가 2000px로 줄여 보내서 넉넉함)


class CreateEventRequest(CamelCaseModel):
    # 앞뒤 공백은 빼고 저장. 빈 이름·DB 길이(100자) 초과는 INVALID_REQUEST
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class CreatedEventResponse(CamelCaseModel):
    event_id: int
    name: str
    access_code: str
    status: EventStatus


class UploadFailureResponse(CamelCaseModel):
    file_name: str
    reason: str   # 에러코드 이름 (UNSUPPORTED_FILE 등) → 프론트가 화면 문구로 바꿈


class UploadResultResponse(CamelCaseModel):
    uploaded: int
    failed: list[UploadFailureResponse]


class UploadCompleteResponse(CamelCaseModel):
    event_id: int
    status: EventStatus
    total_photos: int


class PhotoCountsResponse(CamelCaseModel):
    total: int
    extracted: int
    processing: int
    failed: int


class FailedPhotoResponse(CamelCaseModel):
    photo_id: int
    file_name: str


class EventProgressResponse(CamelCaseModel):
    event_id: int
    name: str
    access_code: str
    status: EventStatus
    photos: PhotoCountsResponse
    person_count: int | None
    failed_photos: list[FailedPhotoResponse]


@router.post("/api/admin/events")
def create_event_endpoint(request: CreateEventRequest, database_session: Session = Depends(get_database_session)):
    event = create_event(database_session, request.name)
    return success_response(CreatedEventResponse(
        event_id=event.id, name=event.name, access_code=event.access_code, status=event.status,
    ))


def read_upload_file(upload_file: UploadFile) -> ReceivedPhotoFile:
    # 기준보다 1바이트만 더 읽어 보면, 아주 큰 파일도 전부 메모리에 올리지 않고 초과 여부를 알 수 있음
    image_bytes = upload_file.file.read(MAXIMUM_PHOTO_BYTES + 1)
    if len(image_bytes) > MAXIMUM_PHOTO_BYTES:
        return ReceivedPhotoFile(file_name=upload_file.filename or "", image_bytes=None)
    return ReceivedPhotoFile(file_name=upload_file.filename or "", image_bytes=image_bytes)


@router.post("/api/admin/events/{event_id}/photos")
def upload_photos_endpoint(
    event_id: int,
    files: list[UploadFile] = File(...),
    database_session: Session = Depends(get_database_session),
):
    # async가 아닌 def: 파일 읽기·NAS 쓰기가 블로킹이라 FastAPI가 별도 스레드에서 실행하게 함
    upload_result = upload_photos(
        database_session, event_id, [read_upload_file(upload_file) for upload_file in files], get_settings().nas_root_path,
    )
    return success_response(UploadResultResponse(
        uploaded=upload_result.uploaded_count,
        failed=[UploadFailureResponse(file_name=failure.file_name, reason=failure.reason.code)
                for failure in upload_result.failures],
    ))


@router.post("/api/admin/events/{event_id}/upload-complete")
def complete_upload_endpoint(event_id: int, database_session: Session = Depends(get_database_session)):
    event, total_photo_count = complete_upload(database_session, event_id)
    return success_response(UploadCompleteResponse(event_id=event.id, status=event.status, total_photos=total_photo_count))


@router.get("/api/admin/events/{event_id}")
def get_event_progress_endpoint(event_id: int, database_session: Session = Depends(get_database_session)):
    progress = get_event_progress(database_session, event_id)
    counts = progress.photo_count_by_status
    return success_response(EventProgressResponse(
        event_id=progress.event.id,
        name=progress.event.name,
        access_code=progress.event.access_code,
        status=progress.event.status,
        photos=PhotoCountsResponse(
            total=sum(counts.values()),   # uploaded(대기 중)도 포함
            extracted=counts.get(PhotoStatus.EXTRACTED, 0),
            processing=counts.get(PhotoStatus.PROCESSING, 0),
            failed=counts.get(PhotoStatus.FAILED, 0),
        ),
        person_count=progress.person_count,
        failed_photos=[FailedPhotoResponse(photo_id=photo.id, file_name=photo.file_name) for photo in progress.failed_photos],
    ))
