import time
from dataclasses import dataclass
from enum import Enum

import jwt

from core.configuration import get_settings
from core.error_codes import ApplicationError, ErrorCode

JWT_ALGORITHM = "HS256"


class TokenRole(Enum):
    # JWT의 role 클레임 값 (docs/api.md 인증 표)
    ADMIN = "admin"
    PARTICIPANT = "participant"


@dataclass(frozen=True)
class TokenPayload:
    # 검증을 통과한 토큰에서 꺼낸 값. 참가자는 event_id가 항상 있고, 관리자는 None
    role: TokenRole
    event_id: int | None


def create_access_token(role: TokenRole, event_id: int | None = None) -> tuple[str, int]:
    # 토큰과 만료까지 남은 초를 함께 반환 (로그인·입장 응답의 accessToken, expiresIn에 사용)
    if role == TokenRole.PARTICIPANT and event_id is None:
        raise ValueError("참가자 토큰에는 event_id가 필요합니다.")

    settings = get_settings()
    expires_in_seconds = settings.access_token_expiration_seconds
    claims = {"role": role.value, "exp": int(time.time()) + expires_in_seconds}
    if event_id is not None:
        claims["eventId"] = event_id

    access_token = jwt.encode(claims, settings.jwt_secret_key, algorithm=JWT_ALGORITHM)
    return access_token, expires_in_seconds


def decode_access_token(access_token: str) -> TokenPayload:
    # 서명·만료·role 값을 검증하고, 하나라도 틀리면 원인 구분 없이 UNAUTHORIZED
    settings = get_settings()
    try:
        claims = jwt.decode(
            access_token,
            settings.jwt_secret_key,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "role"]},
        )
        role = TokenRole(claims["role"])
    except (jwt.InvalidTokenError, ValueError) as error:
        raise ApplicationError(ErrorCode.UNAUTHORIZED) from error

    event_id = claims.get("eventId")
    if role == TokenRole.PARTICIPANT and not isinstance(event_id, int):
        raise ApplicationError(ErrorCode.UNAUTHORIZED)

    return TokenPayload(role=role, event_id=event_id)
