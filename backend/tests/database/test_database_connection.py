"""database_session_scope(워커·스케줄러용)가 성공 시 커밋, 예외 시 롤백하는지 검증.

이 테스트는 롤백 픽스처를 쓰지 않고 실제로 커밋하므로, 만든 행사를 끝에서 직접 지움.
"""

import pytest
from sqlalchemy import delete, select

from database.connection import database_session_scope
from database.models import Event

TEST_ACCESS_CODE = "SCOPE_TEST"


@pytest.fixture
def cleanup_test_event(database_session):
    # database_session을 요청해 DB가 꺼져 있으면 skip되게 함. 테스트 전후로 남은 테스트 행사를 지움
    def remove_test_event():
        with database_session_scope() as cleanup_session:
            cleanup_session.execute(delete(Event).where(Event.access_code == TEST_ACCESS_CODE))

    remove_test_event()
    yield
    remove_test_event()


def find_test_event_id() -> int | None:
    with database_session_scope() as reading_session:
        return reading_session.scalar(select(Event.id).where(Event.access_code == TEST_ACCESS_CODE))


def test_scope_commits_when_block_finishes(cleanup_test_event):
    with database_session_scope() as database_session:
        database_session.add(Event(name="커밋 확인", access_code=TEST_ACCESS_CODE))

    assert find_test_event_id() is not None


def test_scope_rolls_back_when_block_raises(cleanup_test_event):
    with pytest.raises(RuntimeError):
        with database_session_scope() as database_session:
            database_session.add(Event(name="롤백 확인", access_code=TEST_ACCESS_CODE))
            database_session.flush()  # INSERT까지 실행된 뒤에 실패하는 상황
            raise RuntimeError("작업 도중 실패")

    assert find_test_event_id() is None
