# 조회 처리 (API 7·9·10): 공개된(open) 행사의 사진·사람 폴더를 DB에서 읽음
# URL(Pre-signed)과 응답 모양은 router.py가 맡고, 여기는 어떤 사진·사람을 어떤 순서로 보여줄지만 담당
# 공통 규칙: Object Storage에 올라간 사진(object_key 있음)만 보여줌 → failed·보관 누락 사진은 URL을 만들 수 없음
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.error_codes import ApplicationError, ErrorCode
from database.models import Event, EventStatus, Face, Person, Photo


@dataclass(frozen=True)
class PersonFolder:
    # 사람 폴더 1개. 대표 얼굴 사진이 보관되지 않았거나 대표 얼굴이 없으면 representative_* 는 None
    person: Person
    photo_count: int
    representative_photo: Photo | None
    representative_bounding_box: dict | None


def require_open_event(database_session: Session, event_id: int) -> Event:
    event = database_session.get(Event, event_id)
    if event is None:
        raise ApplicationError(ErrorCode.EVENT_NOT_FOUND)
    if event.status != EventStatus.OPEN:
        raise ApplicationError(ErrorCode.EVENT_NOT_READY)   # 분류·보관이 끝나야 사진·폴더가 생김
    return event


def list_event_photos(database_session: Session, event_id: int, page: int, size: int) -> tuple[int, list[Photo]]:
    """API 7: 행사 전체 사진 한 페이지 (사진 id 순서 = 업로드 순서). (전체 장수, 이 페이지 사진들)."""
    require_open_event(database_session, event_id)
    archived = (Photo.event_id == event_id, Photo.object_key.is_not(None))
    total = database_session.scalar(select(func.count()).select_from(Photo).where(*archived))
    photos = list(database_session.scalars(
        select(Photo).where(*archived).order_by(Photo.id).offset((page - 1) * size).limit(size)
    ))
    return total, photos


def list_person_folders(database_session: Session, event_id: int, minimum_photo_count: int) -> list[PersonFolder]:
    """API 10: 사진이 minimum_photo_count장 이상인 사람 폴더. 사진 많은 순 (같으면 사람 id 순)."""
    require_open_event(database_session, event_id)

    # 1) 사람별 사진 수: 한 사진에 같은 사람 얼굴이 두 번 잡혀도 1장, 보관된 사진만 (API 9와 같은 기준)
    photo_count = func.count(func.distinct(Face.photo_id))
    photo_count_rows = database_session.execute(
        select(Face.person_id, photo_count)
        .join(Photo, Photo.id == Face.photo_id)
        .where(Face.event_id == event_id, Face.person_id.is_not(None), Photo.object_key.is_not(None))
        .group_by(Face.person_id)
        .having(photo_count >= minimum_photo_count)
        .order_by(photo_count.desc(), Face.person_id)
    ).all()
    if not photo_count_rows:
        return []

    # 2) 사람·대표 얼굴·대표 얼굴 사진을 각각 한 번에 읽음 (사람 수만큼 쿼리를 반복하지 않게)
    person_ids = [person_id for person_id, _ in photo_count_rows]
    person_by_id = {person.id: person for person in database_session.scalars(select(Person).where(Person.id.in_(person_ids)))}
    representative_face_ids = [person.representative_face_id for person in person_by_id.values() if person.representative_face_id]
    face_by_id = {face.id: face for face in database_session.scalars(select(Face).where(Face.id.in_(representative_face_ids)))}
    photo_by_id = {
        photo.id: photo for photo in database_session.scalars(
            select(Photo).where(Photo.id.in_([face.photo_id for face in face_by_id.values()]), Photo.object_key.is_not(None))
        )
    }

    folders = []
    for person_id, count in photo_count_rows:
        person = person_by_id[person_id]
        representative_face = face_by_id.get(person.representative_face_id)
        representative_photo = photo_by_id.get(representative_face.photo_id) if representative_face else None
        folders.append(PersonFolder(
            person=person,
            photo_count=count,
            representative_photo=representative_photo,
            representative_bounding_box=representative_face.bounding_box if representative_photo else None,
        ))
    return folders


def list_person_photos(database_session: Session, event_id: int, person_id: int) -> tuple[Person, list[Photo]]:
    """API 9: 한 사람이 나온 사진 전부 (사진 id 순서). 다른 행사의 사람이면 PERSON_NOT_FOUND."""
    require_open_event(database_session, event_id)
    person = database_session.get(Person, person_id)
    if person is None or person.event_id != event_id:
        # 다른 행사의 사람 id를 넣어 그 행사 사진을 보는 것을 막음 (참가자 토큰은 경로의 행사만 확인함)
        raise ApplicationError(ErrorCode.PERSON_NOT_FOUND)

    photo_ids_of_person = select(Face.photo_id).where(Face.person_id == person.id)
    photos = list(database_session.scalars(
        select(Photo).where(Photo.id.in_(photo_ids_of_person), Photo.object_key.is_not(None)).order_by(Photo.id)
    ))
    return person, photos
