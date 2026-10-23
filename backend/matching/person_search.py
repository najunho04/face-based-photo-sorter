# 셀카 벡터와 가장 닮은 사람 폴더(persons)를 찾음 (docs/erd.md "매칭 쿼리")
# persons.centroid = 그 사람 얼굴 벡터들의 평균(길이 1) → 셀카 벡터와 코사인 유사도로 비교
from dataclasses import dataclass

import numpy
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database.models import Face, Person

MINIMUM_MATCH_SIMILARITY = 0.40   # 이보다 덜 닮으면 후보에서 뺌 (설계 초기값, 실험으로 0.3~0.5 사이 조정)
MAXIMUM_CANDIDATE_COUNT = 3       # API 명세: 후보는 0~3명


@dataclass
class MatchedPerson:
    # 셀카 매칭 후보 1명. similarity는 정렬·기준값 비교용이고 API 응답에는 넣지 않음 (확률로 오해 방지)
    person_id: int
    label: str
    photo_count: int
    representative_photo_id: int | None
    representative_bounding_box: dict | None
    similarity: float


def find_matching_persons(
    database_session: Session,
    event_id: int,
    selfie_embedding: numpy.ndarray,
    minimum_similarity: float = MINIMUM_MATCH_SIMILARITY,
    maximum_count: int = MAXIMUM_CANDIDATE_COUNT,
) -> list[MatchedPerson]:
    # 1) 같은 행사의 사람 폴더 중 셀카와 가장 가까운 순서로 maximum_count명
    #    cosine_distance = pgvector의 <=> 연산자 (코사인 거리), 1 - 거리 = 코사인 유사도
    cosine_distance = Person.centroid.cosine_distance(numpy.asarray(selfie_embedding, dtype=float).tolist())
    rows = database_session.execute(
        select(Person, (1 - cosine_distance).label("similarity"))
        .where(Person.event_id == event_id)   # 다른 행사의 사람 폴더는 절대 후보가 되면 안 됨
        .order_by(cosine_distance)
        .limit(maximum_count)
    ).all()
    candidates = [(person, float(similarity)) for person, similarity in rows if similarity >= minimum_similarity]
    if not candidates:
        return []

    # 2) 후보마다 사진 수: 한 사진에 같은 사람 얼굴이 두 번 잡혀도 1장으로 셈
    person_ids = [person.id for person, _ in candidates]
    photo_count_by_person_id = dict(database_session.execute(
        select(Face.person_id, func.count(func.distinct(Face.photo_id)))
        .where(Face.person_id.in_(person_ids))
        .group_by(Face.person_id)
    ).all())

    # 3) 대표 얼굴: 어느 사진의 어디(bbox)인지 → 프론트가 원본 사진 위에서 얼굴만 잘라 보여줌
    representative_face_ids = [person.representative_face_id for person, _ in candidates if person.representative_face_id]
    representative_face_by_id = {
        face.id: face for face in database_session.scalars(select(Face).where(Face.id.in_(representative_face_ids)))
    }

    matched_persons = []
    for person, similarity in candidates:
        representative_face = representative_face_by_id.get(person.representative_face_id)
        matched_persons.append(MatchedPerson(
            person_id=person.id,
            label=person.label,
            photo_count=photo_count_by_person_id.get(person.id, 0),
            representative_photo_id=representative_face.photo_id if representative_face else None,
            representative_bounding_box=representative_face.bounding_box if representative_face else None,
            similarity=similarity,
        ))
    return matched_persons
