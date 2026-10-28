import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

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


@pytest.fixture
def database_session():
    """실제 로컬 DB(docker compose)에 붙는 세션. 테스트가 끝나면 전부 롤백되어 데이터가 남지 않음.

    동작 방식:
      1. 커넥션 하나를 열고 바깥 트랜잭션을 시작
      2. 세션은 그 안에서 SAVEPOINT로 동작 → 테스트 코드가 session.commit()을 불러도 실제로는 확정되지 않음
      3. 테스트가 끝나면 바깥 트랜잭션을 롤백 → 테스트끼리 데이터가 섞이지 않음

    DB가 안 떠 있으면 실패 대신 skip (DB 없이도 단위 테스트는 돌 수 있게)
    """
    from database.connection import get_engine

    engine = get_engine()
    try:
        connection = engine.connect()
        connection.execute(text("SELECT 1"))
        # 위 SELECT가 트랜잭션을 자동으로 시작하므로, 아래에서 바깥 트랜잭션을 새로 열기 전에 닫아 줌
        connection.rollback()
    except OperationalError:
        pytest.skip("로컬 DB가 꺼져 있음: backend/에서 docker compose up -d 후 다시 실행")

    outer_transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        outer_transaction.rollback()
        connection.close()
