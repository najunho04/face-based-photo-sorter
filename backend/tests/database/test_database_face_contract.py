"""faces 테이블에 들어갈 값의 '계약' 검증 테스트.

A(분류)와 B(워커)가 이 형식을 똑같이 지켜야 Mock으로 짠 코드가 실제 워커와 붙었을 때도 동작함.
DB 없이 도는 순수 단위 테스트.
"""

import math

import numpy
import pytest

from database.face_contract import (
    EMBEDDING_DIMENSION,
    FaceContractError,
    validate_face_record,
)


def normalized_embedding(seed: int = 0) -> numpy.ndarray:
    # 테스트용 512차원 벡터를 만들고 길이(L2 norm)를 1로 맞춤
    random_generator = numpy.random.default_rng(seed)
    embedding = random_generator.normal(size=EMBEDDING_DIMENSION)
    return embedding / numpy.linalg.norm(embedding)


VALID_BOUNDING_BOX = {"x": 120, "y": 80, "w": 96, "h": 96}


def test_valid_face_record_passes():
    # 예외가 안 나면 통과 (반환값 없음)
    validate_face_record(VALID_BOUNDING_BOX, normalized_embedding())


def test_embedding_as_python_list_is_also_accepted():
    # 워커가 numpy 대신 list로 넘겨도 같은 기준으로 검사
    validate_face_record(VALID_BOUNDING_BOX, normalized_embedding().tolist())


@pytest.mark.parametrize(
    "bounding_box",
    [
        {"x": 120, "y": 80, "w": 96},                          # h 누락
        {"x": 120, "y": 80, "w": 96, "h": 96, "score": 0.9},   # 정해지지 않은 키 추가
        {"x1": 120, "y1": 80, "x2": 216, "y2": 176},           # InsightFace 원본 형식(모서리 좌표) 그대로
        {"x": 120.5, "y": 80, "w": 96, "h": 96},               # 정수가 아님
        {"x": -1, "y": 80, "w": 96, "h": 96},                  # 음수 좌표
        {"x": 120, "y": 80, "w": 0, "h": 96},                  # 너비 0
        {"x": True, "y": 80, "w": 96, "h": 96},                # bool은 int의 하위 타입이라 따로 막아야 함
    ],
)
def test_invalid_bounding_box_is_rejected(bounding_box):
    with pytest.raises(FaceContractError):
        validate_face_record(bounding_box, normalized_embedding())


def test_embedding_with_wrong_dimension_is_rejected():
    short_embedding = normalized_embedding()[:128]

    with pytest.raises(FaceContractError):
        validate_face_record(VALID_BOUNDING_BOX, short_embedding)


def test_embedding_not_normalized_is_rejected():
    # InsightFace의 face.embedding(정규화 전)을 실수로 넣는 경우 → face.normed_embedding을 써야 함
    unnormalized_embedding = normalized_embedding() * 23.0

    with pytest.raises(FaceContractError):
        validate_face_record(VALID_BOUNDING_BOX, unnormalized_embedding)


def test_embedding_with_nan_is_rejected():
    broken_embedding = normalized_embedding()
    broken_embedding[0] = math.nan

    with pytest.raises(FaceContractError):
        validate_face_record(VALID_BOUNDING_BOX, broken_embedding)
