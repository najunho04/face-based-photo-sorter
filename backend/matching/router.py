# 셀카 매칭 API: POST /api/events/{event_id}/match (docs/api.md 8번)
# 여기서는 HTTP만 담당: 참가자 토큰, 파일 형식·용량 검사, 응답 모양. 처리 순서는 service.match_selfie
from collections.abc import Callable
from functools import lru_cache

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.dependencies import require_event_participant
from core.error_codes import ApplicationError, ErrorCode
from core.object_storage import ObjectStorage, get_object_storage
from core.responses import CamelCaseModel, success_response
from core.security import TokenPayload
from database.connection import get_database_session
from database.models import Photo
from matching.service import match_selfie

router = APIRouter(tags=["matching"])

MAXIMUM_SELFIE_BYTES = 10 * 1024 * 1024                       # 휴대폰 셀카는 보통 2~5MB → 10MB까지 허용
ALLOWED_SELFIE_CONTENT_TYPES = {"image/jpeg", "image/png"}    # 에러코드 표: jpg·png 외 형식은 UNSUPPORTED_FILE

# 사진 → 브라우저가 열 수 있는 URL. 운영에서는 Object Storage Pre-signed URL
PhotoUrlBuilder = Callable[[Photo], str | None]


class BoundingBox(CamelCaseModel):
    # 원본 사진 기준 얼굴 위치(px). 프론트가 원본 위에서 이 영역만 잘라 보여줌
    x: int
    y: int
    w: int
    h: int


class RepresentativeFace(CamelCaseModel):
    url: str
    bbox: BoundingBox


class MatchCandidate(CamelCaseModel):
    # 유사도 점수는 넣지 않음 (명세: 확률로 오해 방지). 목록 순서가 곧 닮은 순서
    person_id: int
    label: str
    photo_count: int
    rep_face: RepresentativeFace | None


class SelfieMatchResponse(CamelCaseModel):
    candidates: list[MatchCandidate]


@lru_cache
def get_face_analyzer():
    # InsightFace 모델 로드는 몇 초 걸려서 웹서버 프로세스당 한 번만 만들어 모든 요청에 재사용
    # import도 여기서: 모델이 필요 없는 테스트(가짜 분석기로 교체)에서는 무거운 라이브러리를 불러오지 않음
    from extraction.face_analyzer import FaceAnalyzer

    return FaceAnalyzer()


def get_photo_url_builder(object_storage: ObjectStorage = Depends(get_object_storage)) -> PhotoUrlBuilder:
    # 저장소를 의존성으로 받음: 테스트에서는 진짜 NCP 대신 가짜 저장소를 넣을 수 있음
    # 보관 전이거나 보관에서 빠진 사진(object_key 없음)은 URL을 만들 수 없음
    def build_photo_url(photo: Photo) -> str | None:
        if photo.object_key is None:
            return None
        return object_storage.create_presigned_url(photo.object_key)

    return build_photo_url


@router.post("/api/events/{event_id}/match")
def match_selfie_endpoint(
    event_id: int,
    selfie: UploadFile = File(...),
    token_payload: TokenPayload = Depends(require_event_participant),   # 이 행사의 참가자 토큰만 통과
    database_session: Session = Depends(get_database_session),
    face_analyzer=Depends(get_face_analyzer),
    build_photo_url: PhotoUrlBuilder = Depends(get_photo_url_builder),
):
    # async가 아닌 def: 얼굴 분석은 CPU를 1초 가까이 쓰는 일이라, FastAPI가 별도 스레드에서 실행하게 함
    # (async def 안에서 하면 그동안 다른 요청을 전혀 처리하지 못함)
    if selfie.content_type not in ALLOWED_SELFIE_CONTENT_TYPES:
        raise ApplicationError(ErrorCode.UNSUPPORTED_FILE)
    # 기준보다 1바이트만 더 읽어 보면, 아주 큰 파일도 전부 메모리에 올리지 않고 초과 여부를 알 수 있음
    image_bytes = selfie.file.read(MAXIMUM_SELFIE_BYTES + 1)
    if len(image_bytes) > MAXIMUM_SELFIE_BYTES:
        raise ApplicationError(ErrorCode.FILE_TOO_LARGE)

    matched_persons = match_selfie(database_session, event_id, image_bytes, face_analyzer)
    # 셀카 바이트는 저장하지 않고 이 함수가 끝나면 버려짐 (개인정보)

    # 대표 얼굴이 있는 사진들을 한 번에 불러와 URL을 만듦
    representative_photo_ids = [person.representative_photo_id for person in matched_persons if person.representative_photo_id]
    photo_by_id = {
        photo.id: photo for photo in database_session.scalars(select(Photo).where(Photo.id.in_(representative_photo_ids)))
    }

    candidates = []
    for matched_person in matched_persons:
        representative_photo = photo_by_id.get(matched_person.representative_photo_id)
        representative_face = None
        if representative_photo is not None and matched_person.representative_bounding_box is not None:
            photo_url = build_photo_url(representative_photo)
            # 사람 폴더 목록(API 10)과 같은 규칙: 사진 URL이 없으면 repFace 자체를 null → 프론트는 기본 아이콘
            if photo_url is not None:
                representative_face = RepresentativeFace(
                    url=photo_url,
                    bbox=BoundingBox(**matched_person.representative_bounding_box),
                )
        candidates.append(MatchCandidate(
            person_id=matched_person.person_id,
            label=matched_person.label,
            photo_count=matched_person.photo_count,
            rep_face=representative_face,
        ))
    return success_response(SelfieMatchResponse(candidates=candidates))
