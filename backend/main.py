"""앱 진입점. 실행: backend/에서 uv run uvicorn main:application --reload

새 도메인 라우터는 create_application()의 include_router 목록에 추가.
"""

import logging
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

import authentication.router
import event.router
import gallery.router
import matching.router
from clustering.scheduler import ClusteringScheduler
from core.configuration import get_settings
from core.object_storage import get_object_storage
from core.responses import register_exception_handlers, success_response


# uvicorn은 자기 로그만 설정함 → 분류 스케줄러·보관 등 앱 로그(INFO)도 서버 로그(컨테이너 로그)에 찍히게
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    # 서버가 뜨면 분류 스케줄러를 백그라운드 스레드로 시작, 내려갈 때 멈춤
    # 분류·보관은 numpy·boto3 같은 블로킹 작업이라 이벤트 루프가 아니라 별도 스레드에서 돌림
    # (테스트의 TestClient는 with 없이 쓰면 lifespan을 실행하지 않아 스케줄러가 뜨지 않음)
    settings = get_settings()
    if not settings.clustering_scheduler_enabled:
        yield
        return
    scheduler = ClusteringScheduler(object_storage_provider=get_object_storage, nas_root_path=settings.nas_root_path)
    scheduler_thread = threading.Thread(target=scheduler.run, name="clustering-scheduler", daemon=True)
    scheduler_thread.start()
    try:
        yield
    finally:
        scheduler.stop()
        scheduler_thread.join(timeout=30)   # 분류 중이면 지금 행사까지만 기다림 (못 끝내도 다음 서버가 이어서 처리)


def create_application() -> FastAPI:
    # 테스트에서 매번 새 앱을 만들 수 있게 함수로 둠 (전역 상태가 테스트끼리 섞이지 않음)
    application = FastAPI(title="face-based-photo-sorter", lifespan=lifespan)
    register_exception_handlers(application)   # 어떤 예외든 공통 응답 형식 { success, data, error }로

    application.include_router(authentication.router.router)   # API 1 관리자 로그인, API 6 참가자 입장
    application.include_router(event.router.router)            # API 2~5 행사 생성·업로드·완료·진행 상황
    application.include_router(matching.router.router)         # API 8 셀카 매칭
    application.include_router(gallery.router.router)          # API 7·9·10 전체 사진, 사람 폴더 목록·사진

    @application.get("/health", include_in_schema=False)
    def health_check():
        # 로드밸런서 상태 확인용 (명세 밖). DB는 보지 않음: DB가 잠깐 끊겨도 모든 서버가 한꺼번에 빠지지 않게
        return success_response({"status": "ok"})

    return application


application = create_application()
