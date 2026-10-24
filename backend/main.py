"""앱 진입점. 실행: backend/에서 uv run uvicorn main:application --reload

새 도메인 라우터는 create_application()의 include_router 목록에 추가.
"""

from fastapi import FastAPI

import authentication.router
import matching.router
from core.responses import register_exception_handlers


def create_application() -> FastAPI:
    # 테스트에서 매번 새 앱을 만들 수 있게 함수로 둠 (전역 상태가 테스트끼리 섞이지 않음)
    application = FastAPI(title="face-based-photo-sorter")
    register_exception_handlers(application)   # 어떤 예외든 공통 응답 형식 { success, data, error }로

    application.include_router(authentication.router.router)   # API 1 관리자 로그인, API 6 참가자 입장
    application.include_router(matching.router.router)         # API 8 셀카 매칭
    return application


application = create_application()
