"""앱 진입점(main.py) 테스트: 라우터가 모두 등록됐는지, 공통 응답 형식이 앱 전체에 적용되는지,
서버 시작·종료 때 분류 스케줄러가 켜지고 꺼지는지 (DB 불필요)."""

import threading

from fastapi.testclient import TestClient

from core.configuration import get_settings
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
    assert ("GET", "/api/events/{event_id}/photos") in routes
    assert ("GET", "/api/events/{event_id}/persons") in routes
    assert ("GET", "/api/events/{event_id}/persons/{person_id}/photos") in routes


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


class FakeScheduler:
    # 실제 스케줄러 대신 시작·멈춤만 기록 (DB 없이 lifespan 연결만 확인)
    instances = []

    def __init__(self, object_storage_provider, nas_root_path):
        self.nas_root_path = nas_root_path
        self.is_running = False
        self.stopped = threading.Event()
        FakeScheduler.instances.append(self)

    def run(self):
        self.is_running = True
        self.stopped.wait(5)

    def stop(self):
        self.stopped.set()


def test_application_starts_and_stops_clustering_scheduler(monkeypatch):
    FakeScheduler.instances = []
    monkeypatch.setattr("main.ClusteringScheduler", FakeScheduler)

    # with 블록 = 서버 실행 중 (lifespan 시작·종료)
    with TestClient(create_application()):
        [scheduler] = FakeScheduler.instances
    assert scheduler.is_running is True
    assert scheduler.stopped.is_set()


def test_application_does_not_start_scheduler_when_disabled(monkeypatch):
    FakeScheduler.instances = []
    monkeypatch.setattr("main.ClusteringScheduler", FakeScheduler)
    monkeypatch.setenv("CLUSTERING_SCHEDULER_ENABLED", "false")
    get_settings.cache_clear()

    with TestClient(create_application()):
        pass
    assert FakeScheduler.instances == []


def test_health_check_answers_without_database():
    # 로드밸런서 상태 확인용. DB가 잠깐 끊겨도 서버 전체가 빠지지 않게 DB는 보지 않음 (DB 불필요)
    response = TestClient(create_application()).get("/health")

    assert response.status_code == 200
    assert response.json() == {"success": True, "data": {"status": "ok"}, "error": None}
