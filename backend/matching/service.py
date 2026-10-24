# 셀카 매칭 처리 흐름 (API 8): 행사 확인 → 셀카 읽기 → 얼굴 분석 → 얼굴 고르기 → 닮은 사람 찾기
# HTTP(파일 형식·용량, 토큰, 응답 모양)는 router.py가 맡고, 여기는 순서만 담당해서 DB + 가짜 분석기로 바로 테스트
from sqlalchemy.orm import Session

from core.error_codes import ApplicationError, ErrorCode
from database.models import Event, EventStatus
from extraction.face_analyzer import ImageReadError, read_image_from_bytes
from matching.person_search import MatchedPerson, find_matching_persons
from matching.selfie import select_selfie_face


def match_selfie(database_session: Session, event_id: int, image_bytes: bytes, face_analyzer) -> list[MatchedPerson]:
    # 1) 행사 확인을 먼저: DB 조회 한 번이라 싸고, 1초 걸리는 얼굴 분석을 거절될 요청에 쓰지 않게 함
    event = database_session.get(Event, event_id)
    if event is None:
        raise ApplicationError(ErrorCode.EVENT_NOT_FOUND)
    if event.status != EventStatus.OPEN:
        raise ApplicationError(ErrorCode.EVENT_NOT_READY)   # 아직 분류 중이라 사람 폴더가 없음

    # 2) 셀카 읽기: 파일로 저장하지 않고 메모리에서 바로 디코딩 (셀카는 매칭 직후 버림)
    try:
        image = read_image_from_bytes(image_bytes)
    except ImageReadError as error:
        raise ApplicationError(ErrorCode.UNSUPPORTED_FILE) from error   # 확장자만 jpg이고 내용은 이미지가 아닌 경우

    # 3) 얼굴 분석 → 4) 가장 큰 얼굴 1개 (없으면 FACE_NOT_DETECTED) → 5) 닮은 사람 폴더 0~3명
    selfie_face = select_selfie_face(face_analyzer.analyze(image))
    return find_matching_persons(database_session, event_id, selfie_face.embedding)
