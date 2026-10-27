"""분류 스케줄러 테스트: 멈춘 사진 복구, 분류 시작 조건, 분류 → 보관 → open 흐름.

로컬 DB가 필요함 (backend/에서 docker compose up -d). Object Storage는 moto, NAS는 임시 폴더.
스케줄러는 원래 database_session_scope()로 매번 커밋하지만, 테스트에서는 롤백되는 세션을 그대로 넘김.
여러 서버가 동시에 처리하는 상황은 커넥션 여러 개가 필요해서 잠금 함수만 따로 확인 (전체 동시성은 8단계).
"""

from contextlib import contextmanager
from datetime import timedelta

import boto3
import pytest
from moto import mock_aws
from sqlalchemy import func, select

from clustering.scheduler import (
    ClusteringScheduler,
    hold_event_lock,
    recover_stale_photos,
    start_clustering_if_ready,
)
from core.object_storage import ObjectStorage
from database.models import Event, EventStatus, Face, Person, Photo, PhotoStatus
from tests.clustering.test_clustering_face_grouping import build_face, build_person_base

BUCKET = "test-photos"


@pytest.fixture
def object_storage():
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket=BUCKET)
        yield ObjectStorage(client, BUCKET, presigned_url_expiration_seconds=3600)


def create_event(database_session, status: EventStatus = EventStatus.EXTRACTING, access_code: str = "SCHD01") -> Event:
    event = Event(name="스케줄러 테스트", access_code=access_code, status=status)
    database_session.add(event)
    database_session.flush()
    return event


def add_photo(database_session, event: Event, file_name: str, status: PhotoStatus,
              nas_root=None, embeddings: list | None = None, claimed_minutes_ago: int | None = None) -> Photo:
    photo = Photo(event=event, file_name=file_name, nas_path=f"event{event.id}/{file_name}", status=status)
    if claimed_minutes_ago is not None:
        photo.worker_id = "worker-1"
        photo.claimed_at = func.now() - timedelta(minutes=claimed_minutes_ago)   # 복구 기준과 같은 DB 시계
    if nas_root is not None:
        (nas_root / photo.nas_path).parent.mkdir(parents=True, exist_ok=True)
        (nas_root / photo.nas_path).write_bytes(b"\xff\xd8\xff jpeg")
    database_session.add(photo)
    database_session.flush()
    database_session.add_all([
        Face(photo_id=photo.id, event_id=event.id, embedding=embedding.tolist(),
             bounding_box={"x": 0, "y": 0, "w": 100, "h": 100})
        for embedding in embeddings or []
    ])
    database_session.flush()
    return photo


def build_scheduler(database_session, object_storage, nas_root, is_lock_free: bool = True) -> ClusteringScheduler:
    @contextmanager
    def test_session_scope():
        yield database_session
        database_session.flush()

    @contextmanager
    def fake_event_lock(event_id):
        yield is_lock_free

    return ClusteringScheduler(
        object_storage_provider=lambda: object_storage,
        nas_root_path=nas_root,
        session_scope=test_session_scope,
        event_lock=fake_event_lock,
    )


# --- 멈춘 사진 복구 (워커 큐 규칙 4번) ---

def test_recover_returns_long_processing_photos_to_queue(database_session):
    event = create_event(database_session)
    stale_photo = add_photo(database_session, event, "IMG_0001.jpg", PhotoStatus.PROCESSING, claimed_minutes_ago=6)
    working_photo = add_photo(database_session, event, "IMG_0002.jpg", PhotoStatus.PROCESSING, claimed_minutes_ago=1)

    recovered_photo_ids = recover_stale_photos(database_session)
    database_session.refresh(stale_photo)
    database_session.refresh(working_photo)

    # 로컬 DB에 다른 실험의 멈춘 사진이 남아 있을 수 있어서 포함 여부로 확인
    assert stale_photo.id in recovered_photo_ids and working_photo.id not in recovered_photo_ids
    # 일시 오류와 같이 되돌림: 아무 워커나 다시 잡을 수 있게 담당 정보를 비움
    assert (stale_photo.status, stale_photo.worker_id, stale_photo.claimed_at) == (PhotoStatus.UPLOADED, None, None)
    # 아직 5분이 안 된 사진은 워커가 처리 중일 수 있으므로 그대로
    assert (working_photo.status, working_photo.worker_id) == (PhotoStatus.PROCESSING, "worker-1")


# --- 분류 시작 조건 (extracting → clustering) ---

@pytest.mark.parametrize("pending_status", [PhotoStatus.UPLOADED, PhotoStatus.PROCESSING])
def test_clustering_waits_for_pending_photos(database_session, pending_status):
    event = create_event(database_session)
    add_photo(database_session, event, "IMG_0001.jpg", PhotoStatus.EXTRACTED)
    add_photo(database_session, event, "IMG_0002.jpg", pending_status)

    assert start_clustering_if_ready(database_session, event.id) is False
    database_session.refresh(event)
    assert event.status == EventStatus.EXTRACTING


def test_clustering_starts_when_only_extracted_and_failed_remain(database_session):
    # failed 사진은 기다리지 않음 (docs/erd.md 상태값)
    event = create_event(database_session)
    add_photo(database_session, event, "IMG_0001.jpg", PhotoStatus.EXTRACTED)
    add_photo(database_session, event, "IMG_0002.jpg", PhotoStatus.FAILED)

    assert start_clustering_if_ready(database_session, event.id) is True
    database_session.refresh(event)
    assert event.status == EventStatus.CLUSTERING
    # 이미 바뀐 행사는 다시 True를 받지 않음 → 서버 여러 대 중 한 곳만 분류를 시작
    assert start_clustering_if_ready(database_session, event.id) is False


def test_clustering_does_not_start_while_uploading(database_session):
    # 업로드 완료 전에는 사진이 더 올라올 수 있으므로 남은 사진이 0장이어도 시작하지 않음
    event = create_event(database_session, status=EventStatus.UPLOADING)
    add_photo(database_session, event, "IMG_0001.jpg", PhotoStatus.EXTRACTED)

    assert start_clustering_if_ready(database_session, event.id) is False


# --- 분류 → 보관 → open ---

def test_scheduler_clusters_archives_and_opens_finished_event(database_session, object_storage, tmp_path):
    event = create_event(database_session)
    alice, bob = build_person_base(1), build_person_base(2)
    first_photo = add_photo(database_session, event, "IMG_0001.jpg", PhotoStatus.EXTRACTED, tmp_path,
                            [build_face(alice, 1), build_face(bob, 2)])
    add_photo(database_session, event, "IMG_0002.jpg", PhotoStatus.EXTRACTED, tmp_path, [build_face(alice, 3)])
    add_photo(database_session, event, "IMG_0003.jpg", PhotoStatus.FAILED)

    build_scheduler(database_session, object_storage, tmp_path).run_once()
    database_session.refresh(event)
    database_session.refresh(first_photo)

    assert event.status == EventStatus.OPEN
    labels = database_session.scalars(select(Person.label).where(Person.event_id == event.id).order_by(Person.label)).all()
    assert labels == ["user1", "user2"]
    assert first_photo.object_key == f"event{event.id}/IMG_0001.jpg"


def test_scheduler_leaves_event_with_pending_photos(database_session, object_storage, tmp_path):
    event = create_event(database_session)
    add_photo(database_session, event, "IMG_0001.jpg", PhotoStatus.EXTRACTED, tmp_path, [build_face(build_person_base(1), 1)])
    add_photo(database_session, event, "IMG_0002.jpg", PhotoStatus.UPLOADED)

    build_scheduler(database_session, object_storage, tmp_path).run_once()
    database_session.refresh(event)

    assert event.status == EventStatus.EXTRACTING
    assert database_session.scalar(select(func.count()).where(Person.event_id == event.id)) == 0


def test_scheduler_skips_event_locked_by_another_server(database_session, object_storage, tmp_path):
    event = create_event(database_session)
    add_photo(database_session, event, "IMG_0001.jpg", PhotoStatus.EXTRACTED, tmp_path, [build_face(build_person_base(1), 1)])

    build_scheduler(database_session, object_storage, tmp_path, is_lock_free=False).run_once()
    database_session.refresh(event)

    assert event.status == EventStatus.EXTRACTING


def test_scheduler_retries_only_archive_after_archive_failure(database_session, object_storage, tmp_path):
    # 보관 중 오류(Object Storage 장애 등) → clustering에 남고, 다음 주기에는 분류를 다시 하지 않고 보관만 다시 함
    event = create_event(database_session)
    add_photo(database_session, event, "IMG_0001.jpg", PhotoStatus.EXTRACTED, tmp_path, [build_face(build_person_base(1), 1)])

    def broken_storage():
        raise ConnectionError("Object Storage 연결 실패")

    failing_scheduler = build_scheduler(database_session, object_storage, tmp_path)
    failing_scheduler.object_storage_provider = broken_storage
    failing_scheduler.run_once()   # 예외가 밖으로 나오지 않음 (다른 행사 처리를 막지 않게)
    database_session.refresh(event)
    [person_id] = database_session.scalars(select(Person.id).where(Person.event_id == event.id)).all()
    assert event.status == EventStatus.CLUSTERING

    build_scheduler(database_session, object_storage, tmp_path).run_once()
    database_session.refresh(event)

    assert event.status == EventStatus.OPEN
    assert database_session.scalars(select(Person.id).where(Person.event_id == event.id)).all() == [person_id]


def test_scheduler_continues_with_other_events_after_one_fails(database_session, object_storage, tmp_path):
    # 첫 행사 처리 중 예상 못한 오류가 나도(여기서는 잠금 함수가 오류) 다음 행사는 처리됨
    broken_event = create_event(database_session, access_code="SCHD01")
    healthy_event = create_event(database_session, access_code="SCHD02")
    for event in (broken_event, healthy_event):
        add_photo(database_session, event, "IMG_0001.jpg", PhotoStatus.EXTRACTED, tmp_path, [build_face(build_person_base(1), 1)])

    scheduler = build_scheduler(database_session, object_storage, tmp_path)
    working_lock = scheduler.event_lock

    @contextmanager
    def lock_failing_for_broken_event(event_id):
        if event_id == broken_event.id:
            raise RuntimeError("잠금 실패")
        with working_lock(event_id) as is_locked:
            yield is_locked

    scheduler.event_lock = lock_failing_for_broken_event
    scheduler.run_once()
    database_session.refresh(broken_event)
    database_session.refresh(healthy_event)

    assert broken_event.status == EventStatus.EXTRACTING
    assert healthy_event.status == EventStatus.OPEN


# --- 행사별 잠금 (서버 여러 대) ---

def test_event_lock_is_held_by_one_connection_at_a_time(database_session):
    # 실제 DB advisory lock: 같은 행사는 두 번째 커넥션이 못 잡고, 다른 행사는 잡을 수 있음. 풀면 다시 잡힘
    # database_session은 DB가 꺼져 있으면 skip시키는 용도로만 받음
    event_id = 2_000_000_001   # 실제 행사 id와 겹치지 않는 값
    with hold_event_lock(event_id) as first:
        with hold_event_lock(event_id) as second, hold_event_lock(event_id + 1) as other_event:
            assert (first, second, other_event) == (True, False, True)
    with hold_event_lock(event_id) as after_release:
        assert after_release is True
