"""셀카 매칭 처리 흐름 테스트: 행사 확인 → 셀카 읽기 → 얼굴 분석 → 얼굴 고르기 → 닮은 사람 찾기.

로컬 DB가 필요함 (backend/에서 docker compose up -d). 실제 InsightFace 대신 가짜 분석기를 씀.
"""

import cv2
import numpy
import pytest

from core.error_codes import ApplicationError, ErrorCode
from database.face_contract import EMBEDDING_DIMENSION
from database.models import Event, EventStatus, Face, Person, Photo
from extraction.face_analyzer import DetectedFace
from matching.service import match_selfie


def unit_vector(axis: int) -> numpy.ndarray:
    # axis 번째만 1인 길이 1 벡터. 서로 다른 axis끼리는 코사인 유사도 0 (전혀 안 닮음)
    return numpy.eye(1, EMBEDDING_DIMENSION, axis, dtype=numpy.float32)[0]


class FakeFaceAnalyzer:
    # FaceAnalyzer.analyze(image)만 흉내냄: 정해 둔 얼굴 목록을 돌려주고 몇 번 불렸는지 기록
    def __init__(self, detected_faces):
        self.detected_faces = detected_faces
        self.analyzed_count = 0

    def analyze(self, image):
        self.analyzed_count += 1
        return self.detected_faces


def build_detected_face(embedding: numpy.ndarray, size: int = 200) -> DetectedFace:
    return DetectedFace(bounding_box={"x": 0, "y": 0, "w": size, "h": size}, embedding=embedding, detection_score=0.9)


def selfie_bytes() -> bytes:
    # 실제로 디코딩되는 작은 png (얼굴 여부는 가짜 분석기가 정함)
    return cv2.imencode(".png", numpy.full((60, 60, 3), 128, dtype=numpy.uint8))[1].tobytes()


def create_event(database_session, status: EventStatus = EventStatus.OPEN) -> Event:
    event = Event(name="셀카 매칭 테스트", access_code="SELFIE1", status=status)
    database_session.add(event)
    database_session.flush()
    return event


def create_person(database_session, event: Event, label: str, centroid: numpy.ndarray) -> Person:
    # 사진 1장 + 얼굴 1개짜리 사람 폴더
    photo = Photo(event=event, file_name=f"{label}.jpg", nas_path=f"event{event.id}/{label}.jpg")
    database_session.add(photo)
    database_session.flush()
    person = Person(event=event, label=label, centroid=centroid)
    database_session.add(person)
    database_session.flush()
    face = Face(photo_id=photo.id, event_id=event.id, bounding_box={"x": 1, "y": 2, "w": 96, "h": 96},
                embedding=centroid, person_id=person.id)
    database_session.add(face)
    database_session.flush()
    person.representative_face_id = face.id
    database_session.flush()
    return person


def test_match_returns_similar_person_for_open_event(database_session):
    event = create_event(database_session)
    create_person(database_session, event, "user1", unit_vector(0))
    face_analyzer = FakeFaceAnalyzer([build_detected_face(unit_vector(0))])

    matched_persons = match_selfie(database_session, event.id, selfie_bytes(), face_analyzer)

    assert [person.label for person in matched_persons] == ["user1"]


def test_match_raises_event_not_found_for_unknown_event(database_session):
    with pytest.raises(ApplicationError) as error_information:
        match_selfie(database_session, 999_999_999, selfie_bytes(), FakeFaceAnalyzer([]))

    assert error_information.value.error_code == ErrorCode.EVENT_NOT_FOUND


def test_match_raises_event_not_ready_before_analyzing(database_session):
    # 아직 분류 중인 행사: 1초 걸리는 얼굴 분석을 하기 전에 바로 409 EVENT_NOT_READY
    event = create_event(database_session, status=EventStatus.CLUSTERING)
    face_analyzer = FakeFaceAnalyzer([build_detected_face(unit_vector(0))])

    with pytest.raises(ApplicationError) as error_information:
        match_selfie(database_session, event.id, selfie_bytes(), face_analyzer)

    assert error_information.value.error_code == ErrorCode.EVENT_NOT_READY
    assert face_analyzer.analyzed_count == 0


def test_match_raises_unsupported_file_for_broken_image(database_session):
    # 확장자만 jpg이고 내용이 이미지가 아닌 파일 → 415 UNSUPPORTED_FILE
    event = create_event(database_session)

    with pytest.raises(ApplicationError) as error_information:
        match_selfie(database_session, event.id, b"this is not an image", FakeFaceAnalyzer([]))

    assert error_information.value.error_code == ErrorCode.UNSUPPORTED_FILE


def test_match_raises_face_not_detected_when_selfie_has_no_face(database_session):
    event = create_event(database_session)

    with pytest.raises(ApplicationError) as error_information:
        match_selfie(database_session, event.id, selfie_bytes(), FakeFaceAnalyzer([]))

    assert error_information.value.error_code == ErrorCode.FACE_NOT_DETECTED


def test_match_uses_largest_face_in_selfie(database_session):
    # 셀카에 두 얼굴: 크게 나온 얼굴(user1과 같은 벡터)로 매칭해야 함. 작은 얼굴(user2)은 무시
    event = create_event(database_session)
    create_person(database_session, event, "user1", unit_vector(0))
    create_person(database_session, event, "user2", unit_vector(2))
    face_analyzer = FakeFaceAnalyzer([
        build_detected_face(unit_vector(2), size=80),
        build_detected_face(unit_vector(0), size=300),
    ])

    matched_persons = match_selfie(database_session, event.id, selfie_bytes(), face_analyzer)

    assert [person.label for person in matched_persons] == ["user1"]
