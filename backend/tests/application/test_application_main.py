"""앱 진입점(main.py) 테스트: 라우터가 모두 등록됐는지, 공통 응답 형식이 앱 전체에 적용되는지 (DB 불필요)."""

from fastapi.testclient import TestClient

from main import create_application


def registered_routes() -> set[tuple[str, str]]:
    # OpenAPI 문서 기준으로 확인 (FastAPI 버전에 따라 application.routes 구조가 달라서)
    paths = create_application().openapi()["paths"]
    return {(method.upper(), path) for path, operations in paths.items() for method in operations}


def test_application_registers_all_domain_routes():
    routes = registered_routes()

    assert ("POST", "/api/admin/login") in routes
    assert ("POST", "/api/events/join") in routes
    assert ("POST", "/api/admin/events") in routes
    assert ("POST", "/api/admin/events/{event_id}/photos") in routes
    assert ("POST", "/api/admin/events/{event_id}/upload-complete") in routes
    assert ("GET", "/api/admin/events/{event_id}") in routes
    assert ("POST", "/api/events/{event_id}/match") in routes


def test_application_uses_common_response_format_for_unknown_path():
    # 예외 핸들러가 등록돼 있어야 FastAPI 기본 {"detail": ...} 대신 공통 실패 형식이 나감
    response = TestClient(create_application()).get("/api/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {
        "success": False,
        "data": None,
        "error": {"code": "INVALID_REQUEST", "message": "요청 형식이 올바르지 않습니다."},
    }


def test_application_login_works_end_to_end():
    # main으로 만든 실제 앱에서도 로그인이 동작 (라우터 등록 + 설정 연결 확인)
    response = TestClient(create_application()).post(
        "/api/admin/login", json={"loginId": "admin", "password": "test-password"}
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
