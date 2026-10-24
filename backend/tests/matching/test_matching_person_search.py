"""셀카 벡터와 가까운 사람 폴더(persons) 찾기 테스트 (docs/erd.md "매칭 쿼리").

로컬 DB가 필요함 (backend/에서 docker compose up -d). 각 테스트는 끝나면 롤백됨.
"""

import math

import numpy

from database.face_contract import EMBEDDING_DIMENSION
from database.models import Event, EventStatus, Face, Person, Photo
from matching.person_search import find_matching_persons

SELFIE_EMBEDDING = numpy.eye(1, EMBEDDING_DIMENSION, 0, dtype=numpy.float32)[0]   # [1, 0, 0, …] 길이 1


def vector_with_similarity(similarity: float) -> numpy.ndarray:
    # 셀카 벡터 [1, 0, …]과의 코사인 유사도가 정확히 similarity인 길이 1 벡터: [s, √(1-s²), 0, …]
    vector = numpy.zeros(EMBEDDING_DIMENSION, dtype=numpy.float32)
    vector[0] = similarity
    vector[1] = math.sqrt(1 - similarity * similarity)
    return vector


def create_event(database_session, access_code: str = "MATCH1") -> Event:
    event = Event(name="매칭 테스트 행사", access_code=access_code, status=EventStatus.OPEN)
    database_session.add(event)
    database_session.flush()
    return event


def create_photos(database_session, event: Event, photo_count: int) -> list[Photo]:
    photos = [
        Photo(event=event, file_name=f"IMG_{number}.jpg", nas_path=f"event{event.id}/IMG_{number}.jpg")
        for number in range(photo_count)
    ]
    database_session.add_all(photos)
    database_session.flush()
    return photos


def create_person(database_session, event: Event, label: str, similarity: float, photos: list[Photo]) -> Person:
    # 사람 폴더 1개 + 사진마다 얼굴 1개. 대표 얼굴은 첫 얼굴
    person = Person(event=event, label=label, centroid=vector_with_similarity(similarity))
    database_session.add(person)
    database_session.flush()
    faces = [
        Face(
            photo_id=photo.id,
            event_id=event.id,
            bounding_box={"x": 10 * index, "y": 20, "w": 96, "h": 96},
            embedding=vector_with_similarity(similarity),
            person_id=person.id,
        )
        for index, photo in enumerate(photos)
    ]
    database_session.add_all(faces)
    database_session.flush()
    person.representative_face_id = faces[0].id
    database_session.flush()
    return person


def test_returns_at_most_three_persons_in_similarity_order(database_session):
    event = create_event(database_session)
    photos = create_photos(database_session, event, 1)
    create_person(database_session, event, "user1", 0.50, photos)
    create_person(database_session, event, "user2", 0.90, photos)
    create_person(database_session, event, "user3", 0.45, photos)
    create_person(database_session, event, "user4", 0.70, photos)

    matched_persons = find_matching_persons(database_session, event.id, SELFIE_EMBEDDING)

    # 유사도 높은 순 상위 3명 (API 명세: 0~3명)
    assert [person.label for person in matched_persons] == ["user2", "user4", "user1"]


def test_excludes_persons_below_minimum_similarity(database_session):
    # 기준값보다 덜 닮은 사람은 후보에서 뺌 → 아무도 없으면 빈 목록 ("찾지 못했어요, 다시 찍어주세요")
    event = create_event(database_session)
    photos = create_photos(database_session, event, 1)
    create_person(database_session, event, "user1", 0.60, photos)
    create_person(database_session, event, "user2", 0.30, photos)

    matched_persons = find_matching_persons(database_session, event.id, SELFIE_EMBEDDING, minimum_similarity=0.40)

    assert [person.label for person in matched_persons] == ["user1"]


def test_searches_only_persons_of_the_same_event(database_session):
    # 다른 행사의 사람 폴더는 절대 후보로 나오면 안 됨 (개인정보)
    event = create_event(database_session, access_code="MATCH1")
    other_event = create_event(database_session, access_code="MATCH2")
    create_person(database_session, other_event, "user1", 0.95, create_photos(database_session, other_event, 1))
    create_person(database_session, event, "user1", 0.60, create_photos(database_session, event, 1))

    matched_persons = find_matching_persons(database_session, event.id, SELFIE_EMBEDDING)

    assert len(matched_persons) == 1
    assert matched_persons[0].similarity < 0.9


def test_counts_photos_and_returns_representative_face(database_session):
    # photoCount = 그 사람이 나온 사진 수, repFace = 대표 얼굴의 사진과 bbox (프론트가 원본 위에서 잘라 보여줌)
    event = create_event(database_session)
    photos = create_photos(database_session, event, 3)
    person = create_person(database_session, event, "user1", 0.80, photos)

    matched_person = find_matching_persons(database_session, event.id, SELFIE_EMBEDDING)[0]

    assert matched_person.person_id == person.id
    assert matched_person.photo_count == 3
    assert matched_person.representative_photo_id == photos[0].id
    assert matched_person.representative_bounding_box == {"x": 0, "y": 20, "w": 96, "h": 96}
    assert abs(matched_person.similarity - 0.80) < 1e-4


def test_returns_empty_list_when_event_has_no_persons(database_session):
    event = create_event(database_session)

    assert find_matching_persons(database_session, event.id, SELFIE_EMBEDDING) == []
