# 얼굴 분석 결과 변환·품질 필터 테스트
# InsightFace 모델을 실제로 띄우지 않고 가짜 얼굴 객체로 검증해서 테스트가 빠르고 모델 파일이 없어도 돌아감
from types import SimpleNamespace

import numpy as np
import pytest

from extraction.face_analyzer import (
    DetectedFace,
    convert_detected_face,
    filter_good_quality_faces,
)


def build_fake_insightface_face(left, top, right, bottom, detection_score):
    # InsightFace의 Face 객체에서 우리가 쓰는 속성(bbox, det_score, normed_embedding)만 흉내냄
    normalized_embedding = np.ones(512, dtype=np.float32) / np.sqrt(512)
    return SimpleNamespace(
        bbox=np.array([left, top, right, bottom], dtype=np.float32),
        det_score=np.float32(detection_score),
        normed_embedding=normalized_embedding,
    )


def build_detected_face(width, height, detection_score):
    # 필터 테스트용: 크기와 점수만 의미 있는 DetectedFace
    return DetectedFace(
        bbox={"x": 0, "y": 0, "w": width, "h": height},
        embedding=np.zeros(512, dtype=np.float32),
        detection_score=detection_score,
    )


# --- 변환: InsightFace 결과 → DB(faces.bbox JSON, embedding VECTOR(512))에 넣기 좋은 모양 ---

def test_convert_changes_corner_bbox_to_rounded_xywh():
    # InsightFace는 [왼쪽, 위, 오른쪽, 아래] 실수 좌표, DB는 {"x","y","w","h"} 정수
    insightface_face = build_fake_insightface_face(100.4, 50.6, 220.2, 200.9, 0.9)

    detected_face = convert_detected_face(insightface_face)

    assert detected_face.bbox == {"x": 100, "y": 51, "w": 120, "h": 150}


def test_convert_clips_bbox_that_goes_outside_image():
    # 사진 가장자리 얼굴은 bbox가 음수로 나올 수 있어서 0으로 자름 (나중에 얼굴 crop할 때 오류 방지)
    insightface_face = build_fake_insightface_face(-5, -3, 50, 60, 0.9)

    detected_face = convert_detected_face(insightface_face)

    assert detected_face.bbox == {"x": 0, "y": 0, "w": 50, "h": 60}


def test_convert_keeps_normalized_512_float32_embedding():
    # 벡터는 정규화된 512차원 float32 그대로 유지해야 내적 = 코사인 유사도가 됨
    insightface_face = build_fake_insightface_face(0, 0, 100, 100, 0.9)

    detected_face = convert_detected_face(insightface_face)

    assert detected_face.embedding.shape == (512,)
    assert detected_face.embedding.dtype == np.float32
    assert np.linalg.norm(detected_face.embedding) == pytest.approx(1.0, abs=1e-5)


def test_convert_returns_python_float_detection_score():
    # numpy.float32는 JSON 변환·DB 저장 때 문제가 생길 수 있어서 파이썬 float으로 바꿈
    insightface_face = build_fake_insightface_face(0, 0, 100, 100, 0.87)

    detected_face = convert_detected_face(insightface_face)

    assert type(detected_face.detection_score) is float
    assert detected_face.detection_score == pytest.approx(0.87, abs=1e-6)


# --- 품질 필터: 흐리거나 작은 얼굴은 분류를 망가뜨려서 저장 전에 뺌 ---

def test_filter_removes_low_detection_score_face():
    faces = [build_detected_face(100, 100, 0.9), build_detected_face(100, 100, 0.5)]

    good_faces = filter_good_quality_faces(faces)

    assert [face.detection_score for face in good_faces] == [0.9]


def test_filter_removes_face_smaller_than_minimum_size():
    # 가로·세로 중 짧은 쪽이 기준보다 작으면 제외
    faces = [build_detected_face(100, 100, 0.9), build_detected_face(39, 100, 0.9)]

    good_faces = filter_good_quality_faces(faces)

    assert [face.bbox["w"] for face in good_faces] == [100]


def test_filter_keeps_faces_exactly_at_threshold():
    # 기준값과 같으면 통과 (점수 0.6, 크기 40px)
    faces = [build_detected_face(40, 40, 0.6)]

    good_faces = filter_good_quality_faces(faces)

    assert len(good_faces) == 1


def test_filter_uses_custom_thresholds():
    # 기준값은 실험으로 바꿀 수 있게 인자로 받음
    faces = [build_detected_face(60, 60, 0.7)]

    good_faces = filter_good_quality_faces(faces, minimum_detection_score=0.8, minimum_face_size=40)

    assert good_faces == []
