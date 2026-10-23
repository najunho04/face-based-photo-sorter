# 얼굴 분석 결과 변환·품질 필터 테스트
# InsightFace 모델을 실제로 띄우지 않고 가짜 얼굴 객체로 검증해서 테스트가 빠르고 모델 파일이 없어도 돌아감
from types import SimpleNamespace

import cv2
import numpy
import pytest

from database.face_contract import validate_face_record
from extraction.face_analyzer import (
    DetectedFace,
    FaceAnalyzer,
    ImageReadError,
    convert_detected_face,
    filter_good_quality_faces,
    read_image,
    read_image_from_bytes,
    resize_for_analysis,
)


def build_fake_insightface_face(left, top, right, bottom, detection_score):
    # InsightFace의 Face 객체에서 우리가 쓰는 속성(bbox, det_score, normed_embedding)만 흉내냄
    normalized_embedding = numpy.ones(512, dtype=numpy.float32) / numpy.sqrt(512)
    return SimpleNamespace(
        bbox=numpy.array([left, top, right, bottom], dtype=numpy.float32),
        det_score=numpy.float32(detection_score),
        normed_embedding=normalized_embedding,
    )


def build_detected_face(width, height, detection_score):
    # 필터 테스트용: 크기와 점수만 의미 있는 DetectedFace
    return DetectedFace(
        bounding_box={"x": 0, "y": 0, "w": width, "h": height},
        embedding=numpy.zeros(512, dtype=numpy.float32),
        detection_score=detection_score,
    )


# --- 변환: InsightFace 결과 → DB(faces.bbox JSON, embedding VECTOR(512))에 넣기 좋은 모양 ---

def test_convert_changes_corner_bbox_to_rounded_xywh():
    # InsightFace는 [왼쪽, 위, 오른쪽, 아래] 실수 좌표, DB는 {"x","y","w","h"} 정수
    insightface_face = build_fake_insightface_face(100.4, 50.6, 220.2, 200.9, 0.9)

    detected_face = convert_detected_face(insightface_face)

    assert detected_face.bounding_box == {"x": 100, "y": 51, "w": 120, "h": 150}


def test_convert_clips_bbox_that_goes_outside_image():
    # 사진 가장자리 얼굴은 bbox가 음수로 나올 수 있어서 0으로 자름 (나중에 얼굴 crop할 때 오류 방지)
    insightface_face = build_fake_insightface_face(-5, -3, 50, 60, 0.9)

    detected_face = convert_detected_face(insightface_face)

    assert detected_face.bounding_box == {"x": 0, "y": 0, "w": 50, "h": 60}


def test_convert_keeps_normalized_512_float32_embedding():
    # 벡터는 정규화된 512차원 float32 그대로 유지해야 내적 = 코사인 유사도가 됨
    insightface_face = build_fake_insightface_face(0, 0, 100, 100, 0.9)

    detected_face = convert_detected_face(insightface_face)

    assert detected_face.embedding.shape == (512,)
    assert detected_face.embedding.dtype == numpy.float32
    assert numpy.linalg.norm(detected_face.embedding) == pytest.approx(1.0, abs=1e-5)


def test_convert_returns_python_float_detection_score():
    # numpy.float32는 JSON 변환·DB 저장 때 문제가 생길 수 있어서 파이썬 float으로 바꿈
    insightface_face = build_fake_insightface_face(0, 0, 100, 100, 0.87)

    detected_face = convert_detected_face(insightface_face)

    assert type(detected_face.detection_score) is float
    assert detected_face.detection_score == pytest.approx(0.87, abs=1e-6)


def test_converted_face_satisfies_team_face_contract():
    # 팀 공용 계약(database/face_contract.py)을 통과해야 faces 테이블에 넣을 수 있음
    insightface_face = build_fake_insightface_face(100.4, 50.6, 220.2, 200.9, 0.9)

    detected_face = convert_detected_face(insightface_face)

    validate_face_record(detected_face.bounding_box, detected_face.embedding)   # 예외가 안 나면 통과


# --- 품질 필터: 흐리거나 작은 얼굴은 분류를 망가뜨려서 저장 전에 뺌 ---

def test_filter_removes_low_detection_score_face():
    faces = [build_detected_face(100, 100, 0.9), build_detected_face(100, 100, 0.5)]

    good_faces = filter_good_quality_faces(faces)

    assert [face.detection_score for face in good_faces] == [0.9]


def test_filter_removes_face_smaller_than_minimum_size():
    # 가로·세로 중 짧은 쪽이 기준보다 작으면 제외
    faces = [build_detected_face(100, 100, 0.9), build_detected_face(39, 100, 0.9)]

    good_faces = filter_good_quality_faces(faces)

    assert [face.bounding_box["w"] for face in good_faces] == [100]


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


# --- 축소: 큰 사진은 줄여서 분석 속도를 높이되, bbox는 원본 사진 좌표로 되돌려야 함 ---
# (프론트가 "원본 사진 URL + bbox"로 얼굴을 잘라 보여주기 때문에 축소 좌표가 저장되면 엉뚱한 곳이 잘림)

def test_resize_shrinks_long_side_to_maximum_and_returns_scale():
    image = numpy.zeros((3000, 4000, 3), dtype=numpy.uint8)   # 높이 3000, 너비 4000

    resized_image, scale = resize_for_analysis(image, maximum_side=2000)

    assert resized_image.shape == (1500, 2000, 3)
    assert scale == pytest.approx(0.5)


def test_resize_uses_height_when_photo_is_portrait():
    # 세로 사진은 높이가 긴 변
    image = numpy.zeros((4000, 3000, 3), dtype=numpy.uint8)

    resized_image, scale = resize_for_analysis(image, maximum_side=2000)

    assert resized_image.shape == (2000, 1500, 3)
    assert scale == pytest.approx(0.5)


def test_resize_keeps_small_image_as_is():
    # 이미 작은 사진은 키우지 않음 (키우면 화질만 흐려지고 느려짐)
    image = numpy.zeros((1000, 800, 3), dtype=numpy.uint8)

    resized_image, scale = resize_for_analysis(image, maximum_side=2000)

    assert resized_image.shape == (1000, 800, 3)
    assert scale == 1.0


def test_convert_restores_bbox_to_original_image_coordinates():
    # 절반으로 줄인 사진(scale 0.5)에서 찾은 얼굴 → 원본 좌표는 2배
    insightface_face = build_fake_insightface_face(50, 25, 110, 100, 0.9)

    detected_face = convert_detected_face(insightface_face, scale=0.5)

    assert detected_face.bounding_box == {"x": 100, "y": 50, "w": 120, "h": 150}


# --- 사진 읽기: 워커가 NAS 경로에서 사진을 읽음. 못 읽으면 "영구 오류"로 구분할 수 있게 전용 예외를 냄 ---

def test_read_image_reads_file_in_korean_path(tmp_path):
    # Windows 로컬 개발 경로에 한글이 있어도 읽혀야 함 (cv2.imread는 한글 경로에서 실패)
    image_path = tmp_path / "행사사진.jpg"
    original_image = numpy.full((30, 40, 3), 200, dtype=numpy.uint8)
    cv2.imencode(".jpg", original_image)[1].tofile(image_path)

    image = read_image(image_path)

    assert image.shape == (30, 40, 3)


def test_read_image_raises_when_file_is_missing(tmp_path):
    with pytest.raises(ImageReadError):
        read_image(tmp_path / "없는사진.jpg")


def test_read_image_raises_when_file_is_not_an_image(tmp_path):
    # 업로드 중 깨졌거나 이미지가 아닌 파일
    broken_path = tmp_path / "broken.jpg"
    broken_path.write_bytes(b"this is not an image")

    with pytest.raises(ImageReadError):
        read_image(broken_path)


# --- FaceAnalyzer: 축소 → 모델 검출 → 원본 좌표 변환 → 품질 필터를 한 번에 ---
# 실제 InsightFace 모델 대신 가짜 모델을 넣어서, 모델 없이도 "부품 연결 순서"를 빠르게 검증

class FakeFaceAnalysis:
    # InsightFace FaceAnalysis의 get(image)만 흉내냄: 받은 이미지 크기를 기록하고 정해 둔 얼굴 목록을 돌려줌
    def __init__(self, insightface_faces):
        self.insightface_faces = insightface_faces
        self.received_image_shapes = []

    def get(self, image):
        self.received_image_shapes.append(image.shape)
        return self.insightface_faces


def test_analyzer_analyzes_resized_image_and_returns_original_coordinates():
    fake_face_analysis = FakeFaceAnalysis([build_fake_insightface_face(50, 25, 110, 100, 0.9)])
    face_analyzer = FaceAnalyzer(face_analysis=fake_face_analysis)
    image = numpy.zeros((3000, 4000, 3), dtype=numpy.uint8)

    detected_faces = face_analyzer.analyze(image)

    # 모델에는 줄인 사진이 들어가고, 결과 좌표는 원본 기준으로 돌아와야 함
    assert fake_face_analysis.received_image_shapes == [(1500, 2000, 3)]
    assert [face.bounding_box for face in detected_faces] == [{"x": 100, "y": 50, "w": 120, "h": 150}]


def test_analyzer_drops_low_quality_faces():
    fake_face_analysis = FakeFaceAnalysis([
        build_fake_insightface_face(0, 0, 100, 100, 0.9),   # 통과
        build_fake_insightface_face(0, 0, 100, 100, 0.3),   # 점수 낮음
        build_fake_insightface_face(0, 0, 20, 20, 0.9),     # 너무 작음
    ])
    face_analyzer = FaceAnalyzer(face_analysis=fake_face_analysis)

    detected_faces = face_analyzer.analyze(numpy.zeros((500, 500, 3), dtype=numpy.uint8))

    assert len(detected_faces) == 1


def test_analyzer_returns_empty_list_when_no_face_found():
    # 풍경 사진처럼 얼굴이 없는 사진도 정상 처리 (실패가 아님)
    face_analyzer = FaceAnalyzer(face_analysis=FakeFaceAnalysis([]))

    detected_faces = face_analyzer.analyze(numpy.zeros((500, 500, 3), dtype=numpy.uint8))

    assert detected_faces == []


# --- 바이트에서 읽기: 셀카처럼 파일로 저장하지 않고 업로드 받은 바이트를 바로 분석할 때 (matching이 사용) ---

def test_read_image_from_bytes_decodes_uploaded_image():
    original_image = numpy.full((30, 40, 3), 200, dtype=numpy.uint8)
    image_bytes = cv2.imencode(".png", original_image)[1].tobytes()

    image = read_image_from_bytes(image_bytes)

    assert image.shape == (30, 40, 3)


def test_read_image_from_bytes_raises_when_empty():
    with pytest.raises(ImageReadError):
        read_image_from_bytes(b"")


def test_read_image_from_bytes_raises_when_not_an_image():
    with pytest.raises(ImageReadError):
        read_image_from_bytes(b"this is not an image")
