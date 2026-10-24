# 로그인·입장 처리. HTTP(요청 검사, 응답 모양)는 router.py가 맡고, 여기는 확인 후 토큰 발급만 담당
import secrets
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from authentication.access_code import normalize_access_code
from core.configuration import get_settings
from core.error_codes import ApplicationError, ErrorCode
from core.security import TokenRole, create_access_token
from database.models import Event


@dataclass(frozen=True)
class IssuedToken:
    access_token: str
    expires_in_seconds: int


def login_admin(login_id: str, password: str) -> IssuedToken:
    # 데모용 관리자 계정 1개를 설정(.env)과 비교. 아이디·비밀번호 중 무엇이 틀렸는지는 알려주지 않음
    settings = get_settings()
    # compare_digest: 앞 글자부터 비교하다 멈추는 ==와 달리 항상 끝까지 비교 → 응답 시간으로 비밀번호를 추측하지 못함
    is_login_id_correct = secrets.compare_digest(login_id.encode(), settings.admin_login_id.encode())
    is_password_correct = secrets.compare_digest(password.encode(), settings.admin_password.encode())
    if not (is_login_id_correct and is_password_correct):
        raise ApplicationError(ErrorCode.LOGIN_FAILED)

    access_token, expires_in_seconds = create_access_token(TokenRole.ADMIN)
    return IssuedToken(access_token=access_token, expires_in_seconds=expires_in_seconds)


def join_event(database_session: Session, access_code: str) -> tuple[IssuedToken, Event]:
    # 인증코드로 행사를 찾아 그 행사 전용 참가자 토큰 발급. status≠open이어도 입장은 됨 (프론트가 "정리 중" 표시)
    normalized_access_code = normalize_access_code(access_code)
    if not normalized_access_code:
        raise ApplicationError(ErrorCode.INVALID_REQUEST)   # 공백·하이픈만 보낸 경우

    event = database_session.scalars(select(Event).where(Event.access_code == normalized_access_code)).one_or_none()
    if event is None:
        raise ApplicationError(ErrorCode.INVALID_ACCESS_CODE)

    access_token, expires_in_seconds = create_access_token(TokenRole.PARTICIPANT, event_id=event.id)
    return IssuedToken(access_token=access_token, expires_in_seconds=expires_in_seconds), event
