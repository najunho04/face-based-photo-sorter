import time

import jwt
import pytest

from core.error_codes import ApplicationError, ErrorCode
from core.security import TokenRole, create_access_token, decode_access_token


def test_admin_token_round_trip_has_admin_role_without_event():
    access_token, expires_in_seconds = create_access_token(TokenRole.ADMIN)
    token_payload = decode_access_token(access_token)

    assert token_payload.role == TokenRole.ADMIN
    assert token_payload.event_id is None
    assert expires_in_seconds == 3600


def test_participant_token_round_trip_keeps_event_id():
    access_token, _ = create_access_token(TokenRole.PARTICIPANT, event_id=7)
    token_payload = decode_access_token(access_token)

    assert token_payload.role == TokenRole.PARTICIPANT
    assert token_payload.event_id == 7


def test_participant_token_requires_event_id():
    # 참가자 토큰은 어느 행사 소속인지 없으면 FORBIDDEN 검사를 못 하므로 발급 자체를 막음
    with pytest.raises(ValueError):
        create_access_token(TokenRole.PARTICIPANT)


def test_expired_token_is_unauthorized(test_settings):
    expired_token = jwt.encode(
        {"role": "admin", "exp": int(time.time()) - 10},
        test_settings.jwt_secret_key,
        algorithm="HS256",
    )

    with pytest.raises(ApplicationError) as raised_error:
        decode_access_token(expired_token)
    assert raised_error.value.error_code == ErrorCode.UNAUTHORIZED


def test_token_signed_with_other_key_is_unauthorized():
    forged_token = jwt.encode(
        {"role": "admin", "exp": int(time.time()) + 600},
        "other-secret-key-at-least-32-bytes-long",
        algorithm="HS256",
    )

    with pytest.raises(ApplicationError) as raised_error:
        decode_access_token(forged_token)
    assert raised_error.value.error_code == ErrorCode.UNAUTHORIZED


def test_token_with_unknown_role_is_unauthorized(test_settings):
    unknown_role_token = jwt.encode(
        {"role": "superuser", "exp": int(time.time()) + 600},
        test_settings.jwt_secret_key,
        algorithm="HS256",
    )

    with pytest.raises(ApplicationError) as raised_error:
        decode_access_token(unknown_role_token)
    assert raised_error.value.error_code == ErrorCode.UNAUTHORIZED


def test_token_expires_in_twelve_hours_by_default(monkeypatch):
    # 행사 하루 동안 업로드·열람 중에 다시 로그인·입장하지 않게 12시간 (프론트 요청, .env로 바꿀 수 있음)
    from core.configuration import Settings

    monkeypatch.delenv("ACCESS_TOKEN_EXPIRATION_SECONDS")
    assert Settings(_env_file=None).access_token_expiration_seconds == 12 * 60 * 60
