"""행사 분류 테스트: faces → persons 저장, faces.person_id 채우기 (처리 3).

로컬 DB가 필요함 (backend/에서 docker compose up -d). 각 테스트는 끝나면 롤백됨.
"""

import numpy
import pytest
from sqlalchemy import select

from clustering.service import cluster_event_faces
from core.error_codes import ApplicationError, ErrorCode
from database.models import Event, EventStatus, Face, Person, Photo, PhotoStatus
from tests.clustering.test_clustering_face_grouping import build_face, build_person_base


def create_event(database_session, status: EventStatus = EventStatus.CLUSTERING) -> Event:
    event = Event(name="분류 테스트", access_code="CLUS01", status=status)
    database_session.add(event)
    database_session.flush()
    return event


def add_photo_with_faces(database_session, event: Event, file_name: str, embeddings: list,
                         box_sizes: list[int] | None = None) -> list[Face]:
    photo = Photo(event=event, file_name=file_name, nas_path=f"event{event.id}/{file_name}", status=PhotoStatus.EXTRACTED)
    database_session.add(photo)
    database_session.flush()
    faces = [
        Face(photo_id=photo.id, event_id=event.id, embedding=embedding.tolist(),
             bounding_box={"x": 0, "y": 0, "w": size, "h": size})
        for embedding, size in zip(embeddings, box_sizes or [100] * len(embeddings))
    ]
    database_session.add_all(faces)
    database_session.flush()
    return faces


def persons_of(database_session, event: Event) -> list[Person]:
    return list(database_session.scalars(select(Person).where(Person.event_id == event.id).order_by(Person.label)))


def test_clustering_creates_person_per_people_and_links_faces(database_session):
    event = create_event(database_session)
    alice, bob = build_person_base(1), build_person_base(2)
    # 단체 사진 1장(앨리스+밥) + 앨리스 혼자 2장 → 앨리스 사진 3장, 밥 1장
    group_photo_faces = add_photo_with_faces(database_session, event, "IMG_0001.jpg", [build_face(alice, 1), build_face(bob, 2)])
    alice_faces = [*add_photo_with_faces(database_session, event, "IMG_0002.jpg", [build_face(alice, 3)]),
                   *add_photo_with_faces(database_session, event, "IMG_0003.jpg", [build_face(alice, 4)])]

    result = cluster_event_faces(database_session, event.id)

    assert (result.person_count, result.face_count) == (2, 4)
    alice_person, bob_person = persons_of(database_session, event)
    # 사진이 많은 사람부터 user1
    assert (alice_person.label, bob_person.label) == ("user1", "user2")
    assert {face.person_id for face in [group_photo_faces[0], *alice_faces]} == {alice_person.id}
    assert group_photo_faces[1].person_id == bob_person.id
    # 대표 얼굴은 그 사람 얼굴 중 하나, centroid는 길이 1 (매칭이 코사인 유사도로 비교)
    assert alice_person.representative_face_id in {face.id for face in [group_photo_faces[0], *alice_faces]}
    assert bob_person.representative_face_id == group_photo_faces[1].id
    assert numpy.isclose(numpy.linalg.norm(alice_person.centroid), 1.0)


def test_clustering_again_replaces_previous_result(database_session):
    # 서버가 죽었다 다시 실행하거나 기준값을 바꿔 다시 돌려도 사람 폴더가 두 번 쌓이지 않음
    event = create_event(database_session)
    alice = build_person_base(1)
    add_photo_with_faces(database_session, event, "IMG_0001.jpg", [build_face(alice, 1)])
    add_photo_with_faces(database_session, event, "IMG_0002.jpg", [build_face(alice, 2)])

    cluster_event_faces(database_session, event.id)
    cluster_event_faces(database_session, event.id)

    [person] = persons_of(database_session, event)
    assert person.label == "user1"
    face_person_ids = database_session.scalars(select(Face.person_id).where(Face.event_id == event.id)).all()
    assert face_person_ids == [person.id, person.id]


def test_clustering_event_without_faces_makes_no_persons(database_session):
    # 풍경 사진만 있는 행사도 분류는 끝남 (사람 폴더 0개로 공개)
    event = create_event(database_session)
    add_photo_with_faces(database_session, event, "IMG_0001.jpg", [])

    result = cluster_event_faces(database_session, event.id)

    assert (result.person_count, result.face_count) == (0, 0)
    assert persons_of(database_session, event) == []


def test_clustering_ignores_other_events(database_session):
    event = create_event(database_session)
    other_event = Event(name="다른 행사", access_code="CLUS02", status=EventStatus.CLUSTERING)
    database_session.add(other_event)
    database_session.flush()
    alice = build_person_base(1)
    add_photo_with_faces(database_session, event, "IMG_0001.jpg", [build_face(alice, 1)])
    [other_face] = add_photo_with_faces(database_session, other_event, "IMG_0001.jpg", [build_face(alice, 2)])

    cluster_event_faces(database_session, event.id)

    assert other_face.person_id is None
    assert persons_of(database_session, other_event) == []


@pytest.mark.parametrize("status", [EventStatus.UPLOADING, EventStatus.EXTRACTING, EventStatus.OPEN])
def test_clustering_requires_clustering_status(database_session, status):
    event = create_event(database_session, status=status)

    with pytest.raises(ApplicationError) as error:
        cluster_event_faces(database_session, event.id)
    assert error.value.error_code == ErrorCode.INVALID_STATUS


def test_clustering_unknown_event(database_session):
    with pytest.raises(ApplicationError) as error:
        cluster_event_faces(database_session, 999_999_999)
    assert error.value.error_code == ErrorCode.EVENT_NOT_FOUND
