from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.error_codes import ApplicationError, ErrorCode
from core.security import TokenPayload, TokenRole, decode_access_token

# 인증 보안 규칙 검토. java로 치면 Spring Security의 인증 필터
# auto_error=False: 헤더가 없을 때 FastAPI 기본 403 대신 우리 규칙(401 UNAUTHORIZED)으로 처리하기 위함
bearer_scheme = HTTPBearer(auto_error=False)


def get_token_payload(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> TokenPayload:
    # Authorization: Bearer <token> 헤더를 읽어 검증. 없거나 잘못되면 UNAUTHORIZED
    if credentials is None:
        raise ApplicationError(ErrorCode.UNAUTHORIZED)
    return decode_access_token(credentials.credentials)


def require_admin(token_payload: TokenPayload = Depends(get_token_payload)) -> TokenPayload:
    # 관리자 API(/api/admin/...) 전용. 참가자 토큰이면 FORBIDDEN
    if token_payload.role != TokenRole.ADMIN:
        raise ApplicationError(ErrorCode.FORBIDDEN)
    return token_payload


def require_event_participant(
    event_id: int,
    token_payload: TokenPayload = Depends(get_token_payload),
) -> TokenPayload:
    # 참가자 전용 API. 경로 파라미터 이름이 event_id여야 함 (예: /api/events/{event_id}/match)
    if token_payload.role != TokenRole.PARTICIPANT or token_payload.event_id != event_id:
        raise ApplicationError(ErrorCode.FORBIDDEN)
    return token_payload


def require_admin_or_event_participant(
    event_id: int,
    token_payload: TokenPayload = Depends(get_token_payload),
) -> TokenPayload:
    # 관리자·참가자 공용 API(사람 폴더 목록·사진). 관리자는 모든 행사, 참가자는 자기 행사만
    if token_payload.role == TokenRole.ADMIN:
        return token_payload
    if token_payload.event_id != event_id:
        raise ApplicationError(ErrorCode.FORBIDDEN)
    return token_payload
