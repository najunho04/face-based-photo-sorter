"""셀카에서 매칭에 쓸 얼굴 1개 고르기 테스트. DB·모델 없이 도는 단위 테스트."""

import numpy
import pytest

from core.error_codes import ApplicationError, ErrorCode
from extraction.face_analyzer import DetectedFace
from matching.selfie import select_selfie_face


def build_detected_face(width: int, height: int, detection_score: float = 0.9) -> DetectedFace:
    # 크기만 의미 있는 얼굴 (벡터는 매칭 단계에서 쓰므로 여기서는 아무 값)
    return DetectedFace(
        bounding_box={"x": 0, "y": 0, "w": width, "h": height},
        embedding=numpy.zeros(512, dtype=numpy.float32),
        detection_score=detection_score,
    )


def test_single_face_is_selected():
    only_face = build_detected_face(200, 240)

    assert select_selfie_face([only_face]) is only_face


def test_largest_face_is_selected_when_several_faces():
    # 셀카는 찍는 사람 얼굴이 가장 크게 나옴 → 뒤에 지나가던 사람 얼굴이 아니라 가장 큰 얼굴로 매칭
    small_face = build_detected_face(80, 90)
    large_face = build_detected_face(300, 360)
    middle_face = build_detected_face(150, 170)

    assert select_selfie_face([small_face, large_face, middle_face]) is large_face


def test_no_face_raises_face_not_detected():
    # 얼굴이 없으면 API가 422 FACE_NOT_DETECTED("다시 찍어 주세요")로 응답하도록 공통 예외를 냄
    with pytest.raises(ApplicationError) as error_information:
        select_selfie_face([])

    assert error_information.value.error_code == ErrorCode.FACE_NOT_DETECTED
