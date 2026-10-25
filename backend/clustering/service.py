# 행사 1개 분류: faces를 사람별로 묶어 persons 저장 + faces.person_id 채움 (처리 3)
# 묶는 계산은 face_grouping.py, 여기는 DB에서 읽고 쓰는 순서와 상태 규칙만 담당
import logging
from dataclasses import dataclass

import numpy
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from clustering.face_grouping import DEFAULT_DISTANCE_THRESHOLD, group_faces
from core.error_codes import ApplicationError, ErrorCode
from database.models import Event, EventStatus, Face, Person

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ClusteringResult:
    person_count: int
    face_count: int


def build_person_label(order: int) -> str:
    # 폴더명: 사진이 많은 사람부터 user1, user2, ... (persons.label은 VARCHAR(50))
    return f"user{order}"


def cluster_event_faces(
    database_session: Session,
    event_id: int,
    distance_threshold: float = DEFAULT_DISTANCE_THRESHOLD,
) -> ClusteringResult:
    """행사의 얼굴을 전부 다시 분류. 커밋은 호출한 쪽에서 (persons 저장과 person_id 채우기가 한 트랜잭션).

    다시 실행해도 안전: 이전 결과(persons, faces.person_id)를 지우고 처음부터 만듦
    → 중간에 서버가 죽어 롤백된 뒤 다시 불러도 결과가 두 번 쌓이지 않음
    """
    event = database_session.get(Event, event_id)
    if event is None:
        raise ApplicationError(ErrorCode.EVENT_NOT_FOUND)
    if event.status != EventStatus.CLUSTERING:
        raise ApplicationError(ErrorCode.INVALID_STATUS)   # 추출이 다 끝나 clustering으로 바뀐 행사만

    # 이전 결과 정리 (FK 순서: faces.person_id를 먼저 비워야 persons를 지울 수 있음)
    database_session.execute(update(Face).where(Face.event_id == event.id).values(person_id=None))
    database_session.execute(delete(Person).where(Person.event_id == event.id))

    # failed 사진에는 얼굴이 저장되지 않으므로 행사 얼굴 = extracted 사진의 얼굴 전부
    faces = list(database_session.scalars(select(Face).where(Face.event_id == event.id).order_by(Face.id)))
    if not faces:
        # 얼굴이 하나도 없는 행사(풍경 사진만 등)도 분류는 끝난 것으로 봄 → 사람 폴더 0개로 공개
        logger.info("분류할 얼굴 없음: event_id=%s", event.id)
        return ClusteringResult(person_count=0, face_count=0)

    groups = group_faces(
        embeddings=numpy.stack([numpy.asarray(face.embedding, dtype=numpy.float64) for face in faces]),
        photo_ids=[face.photo_id for face in faces],
        face_areas=numpy.array([face.bounding_box["w"] * face.bounding_box["h"] for face in faces]),
        distance_threshold=distance_threshold,
    )

    for order, group in enumerate(groups, start=1):
        person = Person(
            event_id=event.id,
            label=build_person_label(order),
            representative_face_id=faces[group.representative_index].id,
            centroid=group.centroid.tolist(),
        )
        database_session.add(person)
        database_session.flush()   # person.id를 받아와야 얼굴에 연결할 수 있음
        for face_index in group.face_indexes:
            faces[face_index].person_id = person.id
    database_session.flush()

    logger.info("분류 완료: event_id=%s, 얼굴 %d개 → 사람 %d명", event.id, len(faces), len(groups))
    return ClusteringResult(person_count=len(groups), face_count=len(faces))
