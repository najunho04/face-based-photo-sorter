"""워커 작업 잡기(claim) 테스트. photos.status를 작업 큐로 씀 (docs/erd.md "워커 큐 규칙" 1번).

로컬 DB가 필요함 (backend/에서 docker compose up -d). 각 테스트는 끝나면 롤백됨.
여러 워커가 동시에 잡는 상황(SKIP LOCKED)은 커넥션 2개가 필요해서 8단계에서 따로 검증.
"""

from database.models import Event, Photo, PhotoStatus
from extraction.photo_queue import claim_next_photo


def create_event(database_session, access_code: str = "Q1W2E3") -> Event:
    event = Event(name="큐 테스트 행사", access_code=access_code)
    database_session.add(event)
    database_session.flush()   # INSERT를 실행해 id를 받아옴 (아직 커밋 아님)
    return event


def create_photo(database_session, event: Event, file_name: str, status: PhotoStatus = PhotoStatus.UPLOADED) -> Photo:
    photo = Photo(event=event, file_name=file_name, nas_path=f"/nas/event{event.id}/{file_name}", status=status)
    database_session.add(photo)
    database_session.flush()
    return photo


def test_claim_takes_oldest_uploaded_photo_and_marks_processing(database_session):
    event = create_event(database_session)
    first_photo = create_photo(database_session, event, "IMG_0001.jpg")
    create_photo(database_session, event, "IMG_0002.jpg")

    claimed_photo = claim_next_photo(database_session, worker_id="worker-1")

    # id가 가장 작은(먼저 올라온) 사진부터 처리
    assert claimed_photo.id == first_photo.id
    assert claimed_photo.status == PhotoStatus.PROCESSING


def test_claim_records_worker_id_and_claimed_at(database_session):
    # worker_id: 실패 추적용, claimed_at: 워커가 죽었을 때 5분 지나면 복구하는 기준
    event = create_event(database_session)
    create_photo(database_session, event, "IMG_0001.jpg")

    claimed_photo = claim_next_photo(database_session, worker_id="worker-1")
    database_session.refresh(claimed_photo)   # DB에 실제로 저장된 값으로 다시 읽음

    assert claimed_photo.worker_id == "worker-1"
    assert claimed_photo.claimed_at is not None


def test_claim_twice_returns_different_photos(database_session):
    # 이미 processing이 된 사진은 다시 잡지 않음
    event = create_event(database_session)
    create_photo(database_session, event, "IMG_0001.jpg")
    create_photo(database_session, event, "IMG_0002.jpg")

    first_claimed_photo = claim_next_photo(database_session, worker_id="worker-1")
    second_claimed_photo = claim_next_photo(database_session, worker_id="worker-1")

    assert first_claimed_photo.id != second_claimed_photo.id


def test_claim_ignores_photos_that_are_not_uploaded(database_session):
    # processing(다른 워커가 처리 중), extracted(완료), failed(영구 오류)는 건너뜀
    event = create_event(database_session)
    create_photo(database_session, event, "IMG_0001.jpg", status=PhotoStatus.PROCESSING)
    create_photo(database_session, event, "IMG_0002.jpg", status=PhotoStatus.EXTRACTED)
    create_photo(database_session, event, "IMG_0003.jpg", status=PhotoStatus.FAILED)
    waiting_photo = create_photo(database_session, event, "IMG_0004.jpg")

    claimed_photo = claim_next_photo(database_session, worker_id="worker-1")

    assert claimed_photo.id == waiting_photo.id


def test_claim_returns_none_when_queue_is_empty(database_session):
    # 할 일이 없으면 None → 워커는 몇 초 쉬었다가 다시 확인
    event = create_event(database_session)
    create_photo(database_session, event, "IMG_0001.jpg", status=PhotoStatus.EXTRACTED)

    assert claim_next_photo(database_session, worker_id="worker-1") is None
