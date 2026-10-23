from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from core.dependencies import (
    require_admin,
    require_admin_or_event_participant,
    require_event_participant,
)
from core.responses import register_exception_handlers, success_response
from core.security import TokenPayload, TokenRole, create_access_token


def build_test_client() -> TestClient:
    # 인증 의존성 3종을 각각 붙인 최소 앱. 경로의 event_id와 토큰의 event_id 비교를 검증
    application = FastAPI()
    register_exception_handlers(application)

    @application.get("/admin-only")
    def read_admin_only(token_payload: TokenPayload = Depends(require_admin)):
        return success_response({"role": token_payload.role.value})

    @application.get("/events/{event_id}/participant-only")
    def read_participant_only(token_payload: TokenPayload = Depends(require_event_participant)):
        return success_response({"eventId": token_payload.event_id})

    @application.get("/events/{event_id}/shared")
    def read_shared(token_payload: TokenPayload = Depends(require_admin_or_event_participant)):
        return success_response({"role": token_payload.role.value})

    return TestClient(application)


def authorization_header(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


def admin_token() -> str:
    return create_access_token(TokenRole.ADMIN)[0]


def participant_token(event_id: int) -> str:
    return create_access_token(TokenRole.PARTICIPANT, event_id=event_id)[0]


def test_missing_token_is_unauthorized():
    response = build_test_client().get("/admin-only")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_malformed_token_is_unauthorized():
    response = build_test_client().get("/admin-only", headers=authorization_header("not-a-jwt"))

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_admin_route_accepts_admin_token():
    response = build_test_client().get("/admin-only", headers=authorization_header(admin_token()))

    assert response.status_code == 200
    assert response.json()["data"] == {"role": "admin"}


def test_admin_route_rejects_participant_token_as_forbidden():
    response = build_test_client().get("/admin-only", headers=authorization_header(participant_token(1)))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_participant_route_accepts_token_of_same_event():
    response = build_test_client().get("/events/1/participant-only", headers=authorization_header(participant_token(1)))

    assert response.status_code == 200
    assert response.json()["data"] == {"eventId": 1}


def test_participant_route_rejects_token_of_other_event_as_forbidden():
    response = build_test_client().get("/events/2/participant-only", headers=authorization_header(participant_token(1)))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_participant_route_rejects_admin_token_as_forbidden():
    response = build_test_client().get("/events/1/participant-only", headers=authorization_header(admin_token()))

    assert response.status_code == 403


def test_shared_route_accepts_admin_for_any_event():
    response = build_test_client().get("/events/99/shared", headers=authorization_header(admin_token()))

    assert response.status_code == 200
    assert response.json()["data"] == {"role": "admin"}


def test_shared_route_accepts_participant_of_same_event_only():
    test_client = build_test_client()

    same_event_response = test_client.get("/events/1/shared", headers=authorization_header(participant_token(1)))
    other_event_response = test_client.get("/events/2/shared", headers=authorization_header(participant_token(1)))

    assert same_event_response.status_code == 200
    assert other_event_response.status_code == 403
