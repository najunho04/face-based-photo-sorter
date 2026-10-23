import pytest

from core.configuration import get_settings


@pytest.fixture(autouse=True)
def test_settings(monkeypatch):
    # 테스트가 로컬 .env 값에 흔들리지 않도록 필요한 설정을 고정하고, 캐시된 설정을 매번 새로 읽게 함
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret-key-at-least-32-bytes-long")
    monkeypatch.setenv("ADMIN_LOGIN_ID", "admin")
    monkeypatch.setenv("ADMIN_PASSWORD", "test-password")
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRATION_SECONDS", "3600")
    get_settings.cache_clear()
    yield get_settings()
    get_settings.cache_clear()
