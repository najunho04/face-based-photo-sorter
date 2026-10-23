# 작업 큐: photos.status를 큐로 써서 워커가 처리할 사진을 잡음 (docs/erd.md "워커 큐 규칙")
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from database.face_contract import validate_face_record
from database.models import Face, Photo, PhotoStatus
from extraction.face_analyzer import DetectedFace


def claim_next_photo(database_session: Session, worker_id: str) -> Photo | None:
    """uploaded 사진 중 가장 먼저 올라온 1장을 processing으로 바꾸며 가져옴. 없으면 None.

    호출한 쪽에서 바로 커밋해야 다른 워커에게 processing 상태가 보임
    (잡기는 짧은 트랜잭션으로 끝내고, 시간이 오래 걸리는 얼굴 분석은 트랜잭션 밖에서 함)
    """
    # FOR UPDATE: 고른 행에 lock을 걸어 다른 워커가 같은 사진을 못 바꾸게 함
    # SKIP LOCKED: 다른 워커가 이미 lock건 행은 기다리지 않고 건너뛰어 다음 사진을 고름
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


def complete_photo(
    database_session: Session,
    photo_id: int,
    worker_id: str,
    detected_faces: list[DetectedFace],
) -> bool:
    """규칙 2번: 얼굴 저장 + extracted. 아직 이 워커가 잡고 있는 사진이 아니면 아무것도 안 하고 False.

    한 트랜잭션으로 묶는 건 호출한 쪽의 database_session_scope()가 담당 (중간에 예외가 나면 전부 롤백)
    """
    # 확인~저장 사이에 다른 곳(웹서버 복구 등)이 상태를 못 바꾸게 행을 잠그고, 세션에 남은 옛 값 대신 DB 최신 값을 읽음
    statement = (
        select(Photo)
        .where(Photo.id == photo_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    photo = database_session.scalars(statement).first()
    # 처리 도중 5분 복구로 되돌려졌거나 다른 워커가 다시 잡았으면, 늦게 끝난 이 워커의 결과는 버림
    if photo is None or photo.status != PhotoStatus.PROCESSING or photo.worker_id != worker_id:
        return False

    # INSERT 전에 전부 팀 계약 검사: 하나라도 틀리면 예외 → 이 사진은 아무것도 저장되지 않음
    for detected_face in detected_faces:
        validate_face_record(detected_face.bounding_box, detected_face.embedding)

    # 같은 사진을 다시 처리하는 경우를 대비해 예전 얼굴을 지우고 새로 저장 (얼굴이 두 번 쌓이지 않게)
    database_session.execute(delete(Face).where(Face.photo_id == photo.id))
    database_session.add_all([
        Face(
            photo_id=photo.id,
            event_id=photo.event_id,   # 분류가 행사 단위로 얼굴을 모을 때 쓰는 값
            bounding_box=detected_face.bounding_box,
            embedding=detected_face.embedding,
        )
        for detected_face in detected_faces
    ])
    photo.status = PhotoStatus.EXTRACTED
    database_session.flush()
    return True


def release_photo_for_retry(database_session: Session, photo_id: int) -> None:
    # 규칙 3번 일시 오류(DB 끊김 등): uploaded로 되돌리고 담당 워커 정보를 비워서 아무 워커나 다시 잡게 함
    database_session.execute(
        update(Photo)
        .where(Photo.id == photo_id)
        .values(status=PhotoStatus.UPLOADED, worker_id=None, claimed_at=None)
    )


def mark_photo_failed(database_session: Session, photo_id: int) -> None:
    # 규칙 5번 영구 오류(파일 없음·손상): 다시 시도해도 안 되므로 failed. worker_id는 추적용으로 남김
    # 분류는 failed 사진을 기다리지 않음 (docs/erd.md 상태값)
    database_session.execute(
        update(Photo)
        .where(Photo.id == photo_id)
        .values(status=PhotoStatus.FAILED)
    )
