"""로그인·입장 API 테스트: POST /api/admin/login (API 1), POST /api/events/join (API 6).

관리자 로그인은 DB가 필요 없음. 참가자 입장은 로컬 DB가 필요함 (backend/에서 docker compose up -d).
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from authentication.router import router
from core.responses import register_exception_handlers
from core.security import TokenRole, decode_access_token
from database.connection import get_database_session
from database.models import Event, EventStatus


def build_test_client(database_session=None) -> TestClient:
    # 공통 예외 처리 + 인증 라우터만 붙인 최소 앱. 입장 테스트는 롤백되는 테스트 세션으로 교체
    application = FastAPI()
    register_exception_handlers(application)
    application.include_router(router)
    if database_session is not None:
        application.dependency_overrides[get_database_session] = lambda: database_session
    return TestClient(application, raise_server_exceptions=False)


# --- API 1 관리자 로그인 ---

def test_admin_login_returns_admin_token(test_settings):
    response = build_test_client().post("/api/admin/login", json={"loginId": "admin", "password": "test-password"})

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True and body["error"] is None
    assert body["data"]["expiresIn"] == test_settings.access_token_expiration_seconds
    # 발급된 토큰으로 관리자 API를 부를 수 있어야 함
    token_payload = decode_access_token(body["data"]["accessToken"])
    assert token_payload.role == TokenRole.ADMIN
    assert token_payload.event_id is None


def test_admin_login_with_wrong_password_fails():
    response = build_test_client().post("/api/admin/login", json={"loginId": "admin", "password": "wrong-password"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "LOGIN_FAILED"


def test_admin_login_with_wrong_login_id_fails():
    # 아이디가 틀렸는지 비밀번호가 틀렸는지 구분해서 알려주지 않음 (계정 추측 방지)
    response = build_test_client().post("/api/admin/login", json={"loginId": "someone", "password": "test-password"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "LOGIN_FAILED"


def test_admin_login_without_password_is_invalid_request():
    response = build_test_client().post("/api/admin/login", json={"loginId": "admin"})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_admin_login_with_empty_values_is_invalid_request():
    response = build_test_client().post("/api/admin/login", json={"loginId": "", "password": ""})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


# --- API 6 참가자 입장 ---

def create_event(database_session, access_code: str, status: EventStatus) -> Event:
    event = Event(name="2026 가을 축제", access_code=access_code, status=status)
    database_session.add(event)
    database_session.flush()
    return event


def test_join_open_event_returns_participant_token(database_session):
    event = create_event(database_session, "JOIN01", EventStatus.OPEN)

    response = build_test_client(database_session).post("/api/events/join", json={"accessCode": "JOIN01"})

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["eventId"] == event.id
    assert data["eventName"] == "2026 가을 축제"
    assert data["status"] == "open"
    # 토큰에는 이 행사 번호가 들어 있어서, 다른 행사 API는 FORBIDDEN이 됨
    token_payload = decode_access_token(data["accessToken"])
    assert token_payload.role == TokenRole.PARTICIPANT
    assert token_payload.event_id == event.id


def test_join_event_that_is_not_open_still_returns_token_with_status(database_session):
    # 명세: status≠open이어도 입장은 됨 → 프론트가 status를 보고 "사진 정리 중" 화면을 띄움
    create_event(database_session, "JOIN02", EventStatus.CLUSTERING)

    response = build_test_client(database_session).post("/api/events/join", json={"accessCode": "JOIN02"})

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "clustering"


def test_join_accepts_lowercase_and_hyphenated_access_code(database_session):
    event = create_event(database_session, "JOIN03", EventStatus.OPEN)

    response = build_test_client(database_session).post("/api/events/join", json={"accessCode": " join-03 "})

    assert response.status_code == 200
    assert response.json()["data"]["eventId"] == event.id


def test_join_with_unknown_access_code_fails(database_session):
    response = build_test_client(database_session).post("/api/events/join", json={"accessCode": "NOPE99"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "INVALID_ACCESS_CODE"


def test_join_with_empty_access_code_is_invalid_request():
    # 빈 값은 DB를 조회하기 전에 거절 (DB 불필요)
    response = build_test_client().post("/api/events/join", json={"accessCode": " - "})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_join_without_access_code_is_invalid_request():
    response = build_test_client().post("/api/events/join", json={})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"
