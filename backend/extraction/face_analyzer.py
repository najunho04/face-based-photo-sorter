# 얼굴 분석: InsightFace 결과를 DB(faces 테이블)에 저장할 모양으로 바꾸고, 분류를 방해하는 저품질 얼굴을 걸러냄
from dataclasses import dataclass

import numpy as np

# 품질 기준 (설계 문서 초기값, 실험으로 조정)
MINIMUM_DETECTION_SCORE = 0.6   # 얼굴일 확률이 낮으면 잘못 검출됐을 가능성이 큼
MINIMUM_FACE_SIZE = 40          # 너무 작은 얼굴은 벡터가 부정확해서 다른 사람 묶음끼리 이어 붙일 수 있음


@dataclass
class DetectedFace:
    # faces 테이블 한 행에 들어갈 값: bbox(JSONB), embedding(VECTOR(512)), 검출 점수
    bbox: dict[str, int]
    embedding: np.ndarray
    detection_score: float


def convert_detected_face(insightface_face) -> DetectedFace:
    # InsightFace bbox는 [왼쪽, 위, 오른쪽, 아래] 실수 좌표 → 사진 밖 음수는 0으로 자르고 {"x","y","w","h"} 정수로
    left, top, right, bottom = (float(value) for value in insightface_face.bbox)
    left = max(left, 0.0)
    top = max(top, 0.0)
    bbox = {
        "x": round(left),
        "y": round(top),
        "w": round(right - left),
        "h": round(bottom - top),
    }
    # normed_embedding은 이미 길이 1로 정규화된 512차원 벡터라 타입만 float32로 고정
    embedding = np.asarray(insightface_face.normed_embedding, dtype=np.float32)
    # numpy.float32 점수는 JSON·DB 변환 때 문제가 생길 수 있어 파이썬 float으로 바꿈
    detection_score = float(insightface_face.det_score)
    return DetectedFace(bbox=bbox, embedding=embedding, detection_score=detection_score)


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
        and min(face.bbox["w"], face.bbox["h"]) >= minimum_face_size
    ]
