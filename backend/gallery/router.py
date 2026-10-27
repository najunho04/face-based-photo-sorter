# 조회 API: docs/api.md 7·9·10번. 이미지 주소는 모두 Object Storage Pre-signed URL (만료 expiresIn초)
# 여기서는 HTTP만 담당: 토큰, 쿼리 검사, URL 만들기, 응답 모양. 어떤 사진·사람을 보여줄지는 service.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.dependencies import require_admin_or_event_participant, require_event_participant
from core.object_storage import ObjectStorage, get_object_storage
from core.responses import CamelCaseModel, success_response
from database.connection import get_database_session
from gallery.service import list_event_photos, list_person_folders, list_person_photos
from matching.router import BoundingBox

router = APIRouter(tags=["gallery"])

MAXIMUM_PAGE_SIZE = 100   # 한 번에 URL을 너무 많이 만들지 않게 (프론트 기본 30)


class EventPhotoResponse(CamelCaseModel):
    photo_id: int
    file_name: str
    url: str
    expires_in: int


class EventPhotoPageResponse(CamelCaseModel):
    page: int
    size: int
    total: int
    photos: list[EventPhotoResponse]


class RepresentativeFaceResponse(CamelCaseModel):
    url: str
    bbox: BoundingBox


class PersonFolderResponse(CamelCaseModel):
    person_id: int
    label: str
    photo_count: int
    rep_face: RepresentativeFaceResponse | None   # 대표 얼굴을 보여줄 수 없으면 null → 프론트는 기본 아이콘


class PersonFolderListResponse(CamelCaseModel):
    total: int
    persons: list[PersonFolderResponse]


class PersonPhotoResponse(CamelCaseModel):
    photo_id: int
    file_name: str
    url: str            # 화면에 띄우기용
    download_url: str   # 저장용 (attachment). "전체 다운로드"는 프론트가 차례로 받음
    expires_in: int


class PersonPhotoListResponse(CamelCaseModel):
    person_id: int
    label: str
    total: int
    photos: list[PersonPhotoResponse]


@router.get("/api/events/{event_id}/photos", dependencies=[Depends(require_event_participant)])
def list_event_photos_endpoint(
    event_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(30, ge=1, le=MAXIMUM_PAGE_SIZE),
    database_session: Session = Depends(get_database_session),
    object_storage: ObjectStorage = Depends(get_object_storage),
):
    total, photos = list_event_photos(database_session, event_id, page, size)
    return success_response(EventPhotoPageResponse(
        page=page,
        size=size,
        total=total,
        photos=[EventPhotoResponse(
            photo_id=photo.id,
            file_name=photo.file_name,
            url=object_storage.create_presigned_url(photo.object_key),
            expires_in=object_storage.presigned_url_expiration_seconds,
        ) for photo in photos],
    ))


@router.get("/api/events/{event_id}/persons", dependencies=[Depends(require_admin_or_event_participant)])
def list_person_folders_endpoint(
    event_id: int,
    min_photos: int = Query(1, alias="minPhotos", ge=1),
    database_session: Session = Depends(get_database_session),
    object_storage: ObjectStorage = Depends(get_object_storage),
):
    folders = list_person_folders(database_session, event_id, min_photos)
    return success_response(PersonFolderListResponse(
        total=len(folders),
        persons=[PersonFolderResponse(
            person_id=folder.person.id,
            label=folder.person.label,
            photo_count=folder.photo_count,
            rep_face=RepresentativeFaceResponse(
                url=object_storage.create_presigned_url(folder.representative_photo.object_key),
                bbox=BoundingBox(**folder.representative_bounding_box),
            ) if folder.representative_photo else None,
        ) for folder in folders],
    ))


@router.get("/api/events/{event_id}/persons/{person_id}/photos",
            dependencies=[Depends(require_admin_or_event_participant)])
def list_person_photos_endpoint(
    event_id: int,
    person_id: int,
    database_session: Session = Depends(get_database_session),
    object_storage: ObjectStorage = Depends(get_object_storage),
):
    person, photos = list_person_photos(database_session, event_id, person_id)
    return success_response(PersonPhotoListResponse(
        person_id=person.id,
        label=person.label,
        total=len(photos),
        photos=[PersonPhotoResponse(
            photo_id=photo.id,
            file_name=photo.file_name,
            url=object_storage.create_presigned_url(photo.object_key),
            download_url=object_storage.create_presigned_download_url(photo.object_key, photo.file_name),
            expires_in=object_storage.presigned_url_expiration_seconds,
        ) for photo in photos],
    ))
