# 얼굴 분석: InsightFace 결과를 DB(faces 테이블)에 저장할 모양으로 바꾸고, 분류를 방해하는 저품질 얼굴을 걸러냄
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy

# 품질 기준 (설계 문서 초기값, 실험으로 조정)
MINIMUM_DETECTION_SCORE = 0.6   # 얼굴일 확률이 낮으면 잘못 검출됐을 가능성이 큼
MINIMUM_FACE_SIZE = 40          # 너무 작은 얼굴은 벡터가 부정확해서 다른 사람 묶음끼리 이어 붙일 수 있음
MAXIMUM_ANALYSIS_SIDE = 2000    # 긴 변을 이 크기로 줄여서 분석 (검출 정확도는 거의 그대로, 속도는 크게 빨라짐)


class ImageReadError(Exception):
    # 사진 파일이 없거나 깨져서 읽을 수 없음 = 다시 시도해도 안 되는 "영구 오류" (워커가 photos.status='failed'로 처리)
    pass


@dataclass
class DetectedFace:
    # faces 테이블 한 행에 들어갈 값: bbox(JSONB), embedding(VECTOR(512)), 검출 점수
    bounding_box: dict[str, int]
    embedding: numpy.ndarray
    detection_score: float


def resize_for_analysis(
    image: numpy.ndarray,
    maximum_side: int = MAXIMUM_ANALYSIS_SIDE,
) -> tuple[numpy.ndarray, float]:
    # 긴 변이 maximum_side보다 크면 비율을 유지해 줄이고, 줄인 비율(scale)을 함께 돌려줌
    # scale은 나중에 bbox를 원본 사진 좌표로 되돌릴 때 씀
    height, width = image.shape[:2]   # numpy 이미지 모양은 (높이, 너비, 채널)
    longest_side = max(height, width)
    if longest_side <= maximum_side:
        return image, 1.0   # 이미 작은 사진은 키우지 않음 (화질만 흐려지고 느려짐)

    scale = maximum_side / longest_side
    resized_width = round(width * scale)
    resized_height = round(height * scale)
    # cv2.resize는 크기를 (너비, 높이) 순서로 받음 (numpy와 반대). INTER_AREA는 축소할 때 화질이 좋은 방식
    resized_image = cv2.resize(image, (resized_width, resized_height), interpolation=cv2.INTER_AREA)
    return resized_image, scale


def convert_detected_face(insightface_face, scale: float = 1.0) -> DetectedFace:
    # InsightFace bbox는 [왼쪽, 위, 오른쪽, 아래] 실수 좌표 → 사진 밖 음수는 0으로 자르고 {"x","y","w","h"} 정수로
    # 축소한 사진에서 찾은 좌표는 scale로 나눠 원본 사진 좌표로 되돌림 (팀 계약·프론트 모두 원본 기준)
    left, top, right, bottom = (float(value) / scale for value in insightface_face.bbox)
    left = max(left, 0.0)
    top = max(top, 0.0)
    bounding_box = {
        "x": round(left),
        "y": round(top),
        "w": round(right - left),
        "h": round(bottom - top),
    }
    # normed_embedding은 이미 길이 1로 정규화된 512차원 벡터라 타입만 float32로 고정
    embedding = numpy.asarray(insightface_face.normed_embedding, dtype=numpy.float32)
    # numpy.float32 점수는 JSON·DB 변환 때 문제가 생길 수 있어 파이썬 float으로 바꿈
    detection_score = float(insightface_face.det_score)
    return DetectedFace(bounding_box=bounding_box, embedding=embedding, detection_score=detection_score)


def filter_good_quality_faces(
    faces: list[DetectedFace],
    minimum_detection_score: float = MINIMUM_DETECTION_SCORE,
    minimum_face_size: int = MINIMUM_FACE_SIZE,
) -> list[DetectedFace]:
    # 점수가 낮거나, 가로·세로 중 짧은 쪽이 기준보다 작은 얼굴은 제외 (기준값과 같으면 통과)
    return [
        face
        for face in faces
        if face.detection_score >= minimum_detection_score
        and min(face.bounding_box["w"], face.bounding_box["h"]) >= minimum_face_size
    ]


def read_image(path: str | Path) -> numpy.ndarray:
    # cv2.imread는 Windows 한글 경로를 못 읽어서, 파이썬으로 바이트를 읽은 뒤 OpenCV로 디코딩
    # IMREAD_COLOR는 EXIF 회전 정보를 반영해서, 휴대폰 세로 사진도 화면에 보이는 방향 그대로 읽힘
    try:
        image_bytes = numpy.fromfile(path, dtype=numpy.uint8)
    except OSError as error:   # 파일 없음(FileNotFoundError)·권한 없음 등
        raise ImageReadError(f"사진 파일을 열 수 없음: {path}") from error
    if image_bytes.size == 0:  # 빈 파일은 imdecode가 예외를 내므로 먼저 걸러냄
        raise ImageReadError(f"빈 파일: {path}")

    image = cv2.imdecode(image_bytes, cv2.IMREAD_COLOR)
    if image is None:          # 이미지 형식이 아니거나 깨진 파일
        raise ImageReadError(f"이미지로 읽을 수 없는 파일: {path}")
    return image


def load_insightface_model(model_root: str | None = None):
    # insightface import를 함수 안에 둬서, 가짜 모델을 쓰는 테스트에서는 무거운 라이브러리를 불러오지 않음
    from insightface.app import FaceAnalysis

    model_options = {
        "name": "buffalo_l",
        "providers": ["CPUExecutionProvider"],
        # 검출(detection)과 벡터(recognition)만 로드: 나이·성별 등 안 쓰는 모델을 빼서 속도·메모리 절약
        "allowed_modules": ["detection", "recognition"],
    }
    if model_root:
        # 서버에서는 NAS의 모델 폴더를 지정 → 새로 뜬 워커가 다운로드 없이 바로 로드
        model_options["root"] = model_root

    face_analysis = FaceAnalysis(**model_options)
    face_analysis.prepare(ctx_id=-1, det_size=(640, 640))   # ctx_id=-1: CPU, det_size: 검출용 입력 크기
    return face_analysis


class FaceAnalyzer:
    # 워커가 쓰는 얼굴 분석기: 축소 → 검출·벡터 → 원본 좌표 변환 → 품질 필터를 analyze() 한 번으로 처리

    def __init__(self, face_analysis=None, model_root: str | None = None):
        # 모델 로드는 몇 초 걸려서 워커 프로세스당 한 번만 만들어 재사용
        # 테스트에서는 face_analysis에 가짜 모델을 넣어 모델 파일 없이 검증
        self.face_analysis = face_analysis if face_analysis is not None else load_insightface_model(model_root)

    def analyze(self, image: numpy.ndarray) -> list[DetectedFace]:
        resized_image, scale = resize_for_analysis(image)
        insightface_faces = self.face_analysis.get(resized_image)   # 입력은 BGR 이미지
        detected_faces = [convert_detected_face(insightface_face, scale) for insightface_face in insightface_faces]
        return filter_good_quality_faces(detected_faces)
