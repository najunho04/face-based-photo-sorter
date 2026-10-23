"""DB 접속 관리.

Spring으로 치면 DataSource + EntityManager 설정에 해당.
- 엔진(Engine): 커넥션 풀. 프로세스당 하나만 만들어 재사용
- 세션(Session): 작업 단위. 요청(API) 하나 또는 작업(워커) 하나마다 새로 열고 닫음
"""

from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from core.configuration import get_settings


@lru_cache
def get_engine() -> Engine:
    # 처음 호출될 때 한 번만 엔진(커넥션 풀)을 만듦. 모듈 import 시점이 아니라 호출 시점이라
    # .env가 없는 환경(일부 단위 테스트)에서도 import만으로는 실패하지 않음
    # pool_pre_ping: 풀에서 꺼낸 커넥션이 끊겨 있으면 미리 감지해 새로 연결 (DB 재시작·유휴 끊김 대비)
    return create_engine(get_settings().database_url, pool_pre_ping=True)


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    # 세션을 찍어내는 공장. expire_on_commit=False: 커밋 후에도 객체 값을 그대로 읽을 수 있게 함
    # (응답을 만들 때 커밋 뒤에 다시 DB를 조회하지 않도록)
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_database_session() -> Iterator[Session]:
    """API 서버용: FastAPI 의존성으로 요청마다 세션 하나를 열고, 응답 후 닫음.

    사용 예:
        def read_event(database_session: Session = Depends(get_database_session)): ...

    커밋은 자동으로 하지 않음. 쓰기 작업을 하는 서비스 코드에서 database_session.commit()을 직접 호출.
    (읽기만 하는 API에서 불필요한 커밋을 막고, 커밋 시점을 코드에서 명확히 보이게 하려는 것)
    """
    database_session = get_session_factory()()
    try:
        yield database_session
    finally:
        database_session.close()


@contextmanager
def database_session_scope() -> Iterator[Session]:
    """워커·스케줄러용: with 블록 하나가 트랜잭션 하나. 정상 종료 시 커밋, 예외 시 롤백.

    사용 예 (워커가 faces INSERT + photos.status='extracted'를 한 트랜잭션으로 처리):
        with database_session_scope() as database_session:
            database_session.add_all(faces)
            photo.status = PhotoStatus.EXTRACTED
        # 여기서 자동 커밋. 블록 안에서 예외가 나면 둘 다 롤백되어 반쯤 저장되는 일이 없음
    """
    database_session = get_session_factory()()
    try:
        yield database_session
        database_session.commit()
    except Exception:
        database_session.rollback()
        raise
    finally:
        database_session.close()
