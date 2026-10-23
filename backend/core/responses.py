import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from starlette.exceptions import HTTPException as StarletteHTTPException

from core.error_codes import ApplicationError, ErrorCode

logger = logging.getLogger(__name__)


class CamelCaseModel(BaseModel):
    # 파이썬에선 snake_case로 쓰고, JSON으로 나갈 땐 camelCase (API 규칙). 요청은 둘 다 받음
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


def success_response(data: Any = None) -> dict:
    # 모든 성공 응답을 { success, data, error } 형태로 감쌈. 모델은 camelCase 별칭으로 직렬화
    return {"success": True, "data": jsonable_encoder(data, by_alias=True), "error": None}


def failure_response(error_code: ErrorCode, message: str | None = None) -> JSONResponse:
    # 실패 응답 본문 + 에러코드에 정해진 HTTP 상태를 함께 반환
    return JSONResponse(
        status_code=error_code.http_status,
        content={
            "success": False,
            "data": None,
            "error": {"code": error_code.code, "message": message or error_code.default_message},
        },
    )


def register_exception_handlers(application: FastAPI) -> None:
    # 어떤 예외가 나도 응답 형식이 깨지지 않도록 앱 생성 직후 한 번 등록

    @application.exception_handler(ApplicationError)
    async def handle_application_error(request: Request, error: ApplicationError) -> JSONResponse:
        return failure_response(error.error_code, error.message)

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
        # FastAPI 기본(422) 대신 문서 규칙대로 필수값 누락·형식 오류는 400 INVALID_REQUEST
        return failure_response(ErrorCode.INVALID_REQUEST)

    @application.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, error: StarletteHTTPException) -> JSONResponse:
        # 프레임워크가 직접 내는 오류(없는 경로, 허용 안 된 메서드 등)도 공통 형식으로 맞춤
        if error.status_code == 401:
            return failure_response(ErrorCode.UNAUTHORIZED)
        if error.status_code == 403:
            return failure_response(ErrorCode.FORBIDDEN)
        response = failure_response(ErrorCode.INVALID_REQUEST)
        response.status_code = error.status_code
        return response

    @application.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, error: Exception) -> JSONResponse:
        # 내부 오류 내용은 로그에만 남기고 응답에는 노출하지 않음
        logger.exception("처리되지 않은 예외: %s %s", request.method, request.url.path)
        return failure_response(ErrorCode.INTERNAL_ERROR)
