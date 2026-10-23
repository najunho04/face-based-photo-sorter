"""SQLAlchemy 모델이 실제 DB 스키마(001_initial_schema.sql)와 맞는지 검증하는 통합 테스트.

로컬 DB가 필요함 (backend/에서 docker compose up -d). 각 테스트는 끝나면 롤백됨.
"""

import numpy
import pytest
from sqlalchemy import inspect, select
from sqlalchemy.exc import IntegrityError

from database.face_contract import EMBEDDING_DIMENSION
from database.models import Base, Event, EventStatus, Face, Person, Photo, PhotoStatus


def unit_vector(seed: int) -> numpy.ndarray:
    # 길이 1인 512차원 벡터 (얼굴 임베딩·centroid 흉내)
    random_generator = numpy.random.default_rng(seed)
    vector = random_generator.normal(size=EMBEDDING_DIMENSION)
    return vector / numpy.linalg.norm(vector)


def create_event(database_session, access_code: str = "A7K2Q9") -> Event:
    event = Event(name="2026 가을 축제", access_code=access_code)
    database_session.add(event)
    database_session.flush()  # INSERT를 실행해 id를 받아옴 (아직 커밋 아님)
    return event


def create_photo(database_session, event: Event, file_name: str = "IMG_0001.jpg") -> Photo:
    photo = Photo(event=event, file_name=file_name, nas_path=f"/nas/event{event.id}/{file_name}")
    database_session.add(photo)
    database_session.flush()
    return photo


def test_model_columns_match_database_schema(database_session):
    # 모델에 적은 컬럼과 실제 테이블 컬럼이 정확히 같아야 함 (스키마는 SQL이 기준, create_all 사용 안 함)
    database_inspector = inspect(database_session.connection())

    for table_name, table in Base.metadata.tables.items():
        database_column_names = {column["name"] for column in database_inspector.get_columns(table_name)}
        model_column_names = {column.name for column in table.columns}
        assert model_column_names == database_column_names, table_name


def test_new_event_starts_as_uploading(database_session):
    event = create_event(database_session)
    database_session.refresh(event)

    assert event.id is not None
    assert event.status == EventStatus.UPLOADING


def test_new_photo_starts_as_uploaded_and_belongs_to_event(database_session):
    event = create_event(database_session)
    photo = create_photo(database_session, event)
    database_session.refresh(photo)

    assert photo.status == PhotoStatus.UPLOADED
    assert photo.object_key is None
    assert photo.worker_id is None
    assert event.photos == [photo]


def test_status_is_stored_as_plain_text_value(database_session):
    # DB에는 'extracted' 같은 소문자 문자열이 그대로 저장돼야 워커·SQL 쿼리와 호환됨
    event = create_event(database_session)
    photo = create_photo(database_session, event)
    photo.status = PhotoStatus.EXTRACTED
    database_session.flush()

    stored_status = database_session.execute(
        select(Photo.__table__.c.status).where(Photo.__table__.c.id == photo.id)
    ).scalar_one()
    assert stored_status == "extracted"


def test_face_keeps_bounding_box_and_embedding(database_session):
    event = create_event(database_session)
    photo = create_photo(database_session, event)
    embedding = unit_vector(seed=1)
    face = Face(photo=photo, event=event, bounding_box={"x": 120, "y": 80, "w": 96, "h": 96}, embedding=embedding)
    database_session.add(face)
    database_session.flush()
    database_session.expire(face)  # 메모리 값 대신 DB에서 다시 읽게 함

    assert face.bounding_box == {"x": 120, "y": 80, "w": 96, "h": 96}
    assert len(face.embedding) == EMBEDDING_DIMENSION
    assert numpy.allclose(face.embedding, embedding, atol=1e-6)
    assert face.person_id is None
    assert photo.faces == [face]


def test_person_groups_faces_and_points_to_representative_face(database_session):
    event = create_event(database_session)
    photo = create_photo(database_session, event)
    first_face = Face(photo=photo, event=event, bounding_box={"x": 0, "y": 0, "w": 50, "h": 50}, embedding=unit_vector(1))
    second_face = Face(photo=photo, event=event, bounding_box={"x": 60, "y": 0, "w": 80, "h": 80}, embedding=unit_vector(2))
    database_session.add_all([first_face, second_face])
    database_session.flush()

    person = Person(event=event, label="user1", centroid=unit_vector(3), representative_face_id=second_face.id)
    person.faces = [first_face, second_face]
    database_session.add(person)
    database_session.flush()
    database_session.expire_all()

    assert {face.id for face in person.faces} == {first_face.id, second_face.id}
    assert person.representative_face.id == second_face.id
    assert first_face.person.label == "user1"


def test_person_label_must_be_unique_within_event(database_session):
    event = create_event(database_session)
    database_session.add(Person(event=event, label="user1", centroid=unit_vector(1)))
    database_session.flush()

    database_session.add(Person(event=event, label="user1", centroid=unit_vector(2)))
    with pytest.raises(IntegrityError):
        database_session.flush()


def test_same_label_is_allowed_in_different_events(database_session):
    first_event = create_event(database_session, access_code="AAAAAA")
    second_event = create_event(database_session, access_code="BBBBBB")
    database_session.add_all([
        Person(event=first_event, label="user1", centroid=unit_vector(1)),
        Person(event=second_event, label="user1", centroid=unit_vector(2)),
    ])

    database_session.flush()  # 예외가 없으면 통과


def test_persons_can_be_ordered_by_cosine_distance(database_session):
    # 셀카 매칭(API 8)에서 쓸 쿼리 형태: centroid와 셀카 벡터의 코사인 거리가 가까운 순
    event = create_event(database_session)
    selfie_embedding = unit_vector(seed=10)
    close_centroid = selfie_embedding + unit_vector(seed=11) * 0.1
    close_centroid = close_centroid / numpy.linalg.norm(close_centroid)
    database_session.add_all([
        Person(event=event, label="far", centroid=unit_vector(seed=12)),
        Person(event=event, label="close", centroid=close_centroid),
    ])
    database_session.flush()

    ordered_labels = database_session.scalars(
        select(Person.label)
        .where(Person.event_id == event.id)
        .order_by(Person.centroid.cosine_distance(selfie_embedding))
    ).all()

    assert ordered_labels == ["close", "far"]
