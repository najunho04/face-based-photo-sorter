# 작업 큐: photos.status를 큐로 써서 워커가 처리할 사진을 잡음 (docs/erd.md "워커 큐 규칙")
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database.models import Photo, PhotoStatus


def claim_next_photo(database_session: Session, worker_id: str) -> Photo | None:
    """uploaded 사진 중 가장 먼저 올라온 1장을 processing으로 바꾸며 가져옴. 없으면 None.

    호출한 쪽에서 바로 커밋해야 다른 워커에게 processing 상태가 보임
    (잡기는 짧은 트랜잭션으로 끝내고, 시간이 오래 걸리는 얼굴 분석은 트랜잭션 밖에서 함)
    """
    # FOR UPDATE: 고른 행에 자물쇠를 걸어 다른 워커가 같은 사진을 못 바꾸게 함
    # SKIP LOCKED: 다른 워커가 이미 자물쇠를 건 행은 기다리지 않고 건너뛰어 다음 사진을 고름
    statement = (
        select(Photo)
        .where(Photo.status == PhotoStatus.UPLOADED)
        .order_by(Photo.id)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    photo = database_session.scalars(statement).first()
    if photo is None:
        return None

    photo.status = PhotoStatus.PROCESSING
    photo.worker_id = worker_id
    # 워커 서버마다 시계가 조금씩 다를 수 있어서, 복구 기준 시각은 DB 서버 시계(now())로 통일
    photo.claimed_at = func.now()
    database_session.flush()   # UPDATE를 바로 실행 (커밋은 호출한 쪽에서)
    return photo
