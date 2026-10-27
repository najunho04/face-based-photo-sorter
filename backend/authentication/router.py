# 로그인·입장 API: POST /api/admin/login (docs/api.md 1번), POST /api/events/join (6번)
# 둘 다 토큰을 받기 전에 부르는 API라 인증 의존성 없음
from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy.orm import Session

from authentication.service import join_event, login_admin
from core.responses import CamelCaseModel, success_response
from database.connection import get_database_session
from database.models import EventStatus

router = APIRouter(tags=["authentication"])


class AdminLoginRequest(CamelCaseModel):
    # 빈 문자열은 비교할 필요도 없이 형식 오류(INVALID_REQUEST)
    login_id: str = Field(min_length=1)
    password: str = Field(min_length=1)


class AdminLoginResponse(CamelCaseModel):
    access_token: str
    expires_in: int


class EventJoinRequest(CamelCaseModel):
    # 길이 제한은 정규화 전 값 기준으로 넉넉히 (DB는 16자, 사람이 넣는 공백·하이픈 여유)
    access_code: str = Field(min_length=1, max_length=32)


class EventJoinResponse(CamelCaseModel):
    access_token: str
    event_id: int
    event_name: str
    status: EventStatus


@router.post("/api/admin/login")
def admin_login_endpoint(request: AdminLoginRequest):
    issued_token = login_admin(request.login_id, request.password)
    return success_response(AdminLoginResponse(
        access_token=issued_token.access_token,
        expires_in=issued_token.expires_in_seconds,
    ))


@router.post("/api/events/join")
def event_join_endpoint(request: EventJoinRequest, database_session: Session = Depends(get_database_session)):
    # 읽기만 하므로 커밋 없음
    issued_token, event = join_event(database_session, request.access_code)
    return success_response(EventJoinResponse(
        access_token=issued_token.access_token,
        event_id=event.id,
        event_name=event.name,
        status=event.status,
    ))
