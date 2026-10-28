# 웹서버 백그라운드 작업: 몇 초마다 아래를 반복 (docs/erd.md 상태값, 워커 큐 규칙 4번)
#   1) 워커 사망 복구: claimed_at이 5분 넘은 processing 사진을 uploaded로 되돌림
#   2) 분류 시작: extracting 행사 중 uploaded·processing 사진이 0장인 행사를 clustering으로 바꿈
#   3) 분류 → 보관 → open: clustering 행사를 분류하고 Object Storage에 보관한 뒤 공개
#
# API 서버가 여러 대여도 같은 행사를 두 서버가 동시에 처리하지 않게 행사별 PostgreSQL advisory lock을 잡음
#   - 잠금은 잡은 커넥션이 끊기면 DB가 자동으로 풀어 줌 → 처리 중 서버가 죽어도 다른 서버가 이어서 처리
import logging
import threading
from collections.abc import Callable, Iterator
from contextlib import AbstractContextManager, contextmanager
from datetime import timedelta
from pathlib import Path

from sqlalchemy import exists, func, select, update
from sqlalchemy.orm import Session

from archive.service import archive_and_open_event
from clustering.service import cluster_event_faces
from core.object_storage import ObjectStorage
from database.connection import database_session_scope, get_engine
from database.models import Event, EventStatus, Person, Photo, PhotoStatus

logger = logging.getLogger(__name__)

STALE_CLAIM_TIMEOUT = timedelta(minutes=5)   # 워커가 이 시간 안에 끝내지 못한 사진은 죽은 것으로 봄
INTERVAL_SECONDS = 5                          # 관리자 화면 폴링(몇 초)과 비슷하게 확인


def recover_stale_photos(database_session: Session, stale_after: timedelta = STALE_CLAIM_TIMEOUT) -> list[int]:
    """워커 큐 규칙 4번: 오래 processing인 사진을 일시 오류(3번)와 같이 uploaded로 되돌림. 되돌린 사진 id 목록."""
    # 기준 시각은 DB 시계 (claimed_at도 DB의 now()로 기록됨 → 서버마다 시계가 달라도 같은 기준)
    # 늦게 끝난 워커의 결과는 complete_photo가 worker_id를 확인해서 버림
    return list(database_session.scalars(
        update(Photo)
        .where(Photo.status == PhotoStatus.PROCESSING, Photo.claimed_at < func.now() - stale_after)
        .values(status=PhotoStatus.UPLOADED, worker_id=None, claimed_at=None)
        .returning(Photo.id)
    ))


def start_clustering_if_ready(database_session: Session, event_id: int) -> bool:
    """extracting → clustering. 바꿨으면 True. 아직 남은 사진이 있거나 다른 상태면 False.

    조건 확인과 변경을 UPDATE 한 번으로 해서, 서버 여러 대가 동시에 불러도 한 곳만 True를 받음
    """
    has_pending_photos = exists().where(
        Photo.event_id == Event.id,
        Photo.status.in_([PhotoStatus.UPLOADED, PhotoStatus.PROCESSING]),   # failed는 기다리지 않음
    )
    started_event_id = database_session.scalar(
        update(Event)
        .where(Event.id == event_id, Event.status == EventStatus.EXTRACTING, ~has_pending_photos)
        .values(status=EventStatus.CLUSTERING)
        .returning(Event.id)
    )
    return started_event_id is not None


@contextmanager
def hold_event_lock(event_id: int) -> Iterator[bool]:
    """행사별 잠금. 잡았으면 True, 다른 서버가 처리 중이면 기다리지 않고 False."""
    # 분류·보관은 여러 번 커밋하므로 트랜잭션 잠금이 아니라 커넥션(세션) 잠금을 쓰고, 작업용과 다른 커넥션에 둠
    with get_engine().connect() as lock_connection:
        is_locked = lock_connection.scalar(select(func.pg_try_advisory_lock(event_id)))
        lock_connection.commit()   # 잠금은 커넥션에 남고, 트랜잭션은 열어 두지 않음 (idle in transaction 방지)
        try:
            yield is_locked
        finally:
            if is_locked:
                lock_connection.execute(select(func.pg_advisory_unlock(event_id)))
                lock_connection.commit()


class ClusteringScheduler:
    def __init__(
        self,
        object_storage_provider: Callable[[], ObjectStorage],
        nas_root_path: str | Path,
        session_scope: Callable[[], AbstractContextManager[Session]] = database_session_scope,
        event_lock: Callable[[int], AbstractContextManager[bool]] = hold_event_lock,
        interval_seconds: float = INTERVAL_SECONDS,
    ):
        # object_storage_provider: 보관할 때만 부름 → NCP 키가 없는 로컬에서도 서버는 뜸 (보관 단계에서만 오류)
        # session_scope·event_lock: 테스트에서는 롤백되는 세션, 항상 잡히는 가짜 잠금으로 바꿈
        self.object_storage_provider = object_storage_provider
        self.nas_root_path = nas_root_path
        self.session_scope = session_scope
        self.event_lock = event_lock
        self.interval_seconds = interval_seconds
        self.stop_requested = threading.Event()

    def run_once(self) -> None:
        with self.session_scope() as database_session:
            recovered_photo_ids = recover_stale_photos(database_session)
        if recovered_photo_ids:
            logger.warning("멈춘 사진을 대기열로 되돌림: photo_ids=%s", recovered_photo_ids)

        with self.session_scope() as database_session:
            event_ids = list(database_session.scalars(
                select(Event.id)
                .where(Event.status.in_([EventStatus.EXTRACTING, EventStatus.CLUSTERING]))
                .order_by(Event.id)
            ))
        for event_id in event_ids:
            try:
                self.process_event(event_id)
            except Exception:
                # 한 행사의 오류(보관 실패 등)가 다른 행사 처리를 막지 않게 함. 이 행사는 다음 주기에 다시 시도
                logger.exception("행사 처리 실패, 다음 주기에 다시 시도: event_id=%s", event_id)

    def process_event(self, event_id: int) -> None:
        with self.event_lock(event_id) as is_locked:
            if not is_locked:
                return   # 다른 서버가 처리 중
            with self.session_scope() as database_session:
                if start_clustering_if_ready(database_session, event_id):
                    logger.info("추출 끝, 분류 시작: event_id=%s", event_id)

            with self.session_scope() as database_session:
                event = database_session.get(Event, event_id)
                if event is None or event.status != EventStatus.CLUSTERING:
                    return   # 아직 추출 중
                # 분류는 한 트랜잭션이라 persons가 있으면 이미 끝난 것 → 보관에서 멈췄던 행사는 보관만 다시 함
                has_persons = database_session.scalar(select(exists().where(Person.event_id == event_id)))
                if not has_persons:
                    cluster_event_faces(database_session, event_id)

            with self.session_scope() as database_session:
                archive_and_open_event(database_session, event_id, self.object_storage_provider(), self.nas_root_path)

    def run(self) -> None:
        # stop()이 불릴 때까지 반복. wait()는 기다리는 중에도 stop()이 오면 바로 깨어남
        logger.info("분류 스케줄러 시작 (%s초마다)", self.interval_seconds)
        while not self.stop_requested.is_set():
            try:
                self.run_once()
            except Exception:
                # DB 끊김 등: 스레드가 죽으면 이후 행사가 영원히 분류되지 않으므로 로그만 남기고 계속
                logger.exception("분류 스케줄러 오류, 다음 주기에 다시 시도")
            self.stop_requested.wait(self.interval_seconds)

    def stop(self) -> None:
        self.stop_requested.set()
