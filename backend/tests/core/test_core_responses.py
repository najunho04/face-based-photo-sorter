from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from core.error_codes import ApplicationError, ErrorCode
from core.responses import CamelCaseModel, register_exception_handlers, success_response


class SampleEventResponse(CamelCaseModel):
    event_id: int
    access_code: str


class SampleCreateRequest(BaseModel):
    name: str


def build_test_client() -> TestClient:
    # 공통 응답·예외 처리만 검증하기 위한 최소 앱 (실제 라우터와 무관)
    application = FastAPI()
    register_exception_handlers(application)

    @application.get("/success")
    def read_success():
        return success_response(SampleEventResponse(event_id=1, access_code="A7K2Q9"))

    @application.get("/application-error")
    def read_application_error():
        raise ApplicationError(ErrorCode.EVENT_NOT_FOUND)

    @application.post("/validation-error")
    def create_with_validation(request_body: SampleCreateRequest):
        return success_response({"name": request_body.name})

    @application.get("/unexpected-error")
    def read_unexpected_error():
        raise RuntimeError("database connection lost")

    return TestClient(application, raise_server_exceptions=False)


def test_success_response_wraps_data_with_camel_case_fields():
    response = build_test_client().get("/success")

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "data": {"eventId": 1, "accessCode": "A7K2Q9"},
        "error": None,
    }


def test_application_error_becomes_failure_response_with_document_status():
    response = build_test_client().get("/application-error")

    assert response.status_code == 404
    assert response.json() == {
        "success": False,
        "data": None,
        "error": {"code": "EVENT_NOT_FOUND", "message": ErrorCode.EVENT_NOT_FOUND.default_message},
    }


def test_request_validation_error_becomes_invalid_request():
    # FastAPI 기본은 422지만 문서 규칙상 필수값 누락은 400 INVALID_REQUEST
    response = build_test_client().post("/validation-error", json={})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_unexpected_exception_becomes_internal_error_without_leaking_details():
    response = build_test_client().get("/unexpected-error")

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "database connection lost" not in response.text
