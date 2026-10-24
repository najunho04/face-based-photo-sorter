# 실험용 행사의 처리 상황 요약: 상태별 사진 수, 워커별 처리 수, 저장된 얼굴 수
# 실행: backend/에서 uv run python -m extraction.experiments.show_extraction_status
from sqlalchemy import func, select

from database.connection import database_session_scope
from database.models import Event, Face, Photo

EXPERIMENT_ACCESS_CODE = "GALLAGHER"

with database_session_scope() as database_session:
    event = database_session.scalars(select(Event).where(Event.access_code == EXPERIMENT_ACCESS_CODE)).one()

    print("[상태별 사진 수]")
    for status, photo_count in database_session.execute(
        select(Photo.status, func.count()).where(Photo.event_id == event.id).group_by(Photo.status)
    ):
        print(f"  {status.value:<11} {photo_count}")

    print("[워커별 처리 수] (합계가 전체 사진 수와 같으면 중복 처리 없음)")
    for worker_id, photo_count in database_session.execute(
        select(Photo.worker_id, func.count()).where(Photo.event_id == event.id, Photo.worker_id.is_not(None))
        .group_by(Photo.worker_id)
    ):
        print(f"  {worker_id:<30} {photo_count}")

    face_count = database_session.scalar(select(func.count()).select_from(Face).where(Face.event_id == event.id))
    photos_with_face = database_session.scalar(
        select(func.count(func.distinct(Face.photo_id))).where(Face.event_id == event.id)
    )
    print(f"[얼굴] {face_count}개 (얼굴이 1개 이상 나온 사진 {photos_with_face}장)")
