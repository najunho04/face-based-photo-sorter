"""faces 테이블에 저장할 값의 '계약' (A·B 공용).

왜 필요한가
- B의 워커가 실제로 만든 얼굴 데이터와, A가 테스트용으로 만든 Mock 얼굴 데이터가 같은 형식이어야
  Mock으로 개발한 분류·조회 코드가 실제 워커와 붙었을 때 그대로 동작함
- 그래서 형식을 이 함수 하나로 정의하고, 워커는 INSERT 직전에, Mock 생성기는 만들 때 이걸 통과시킴

형식
- bounding_box: {"x", "y", "w", "h"} 4개 키만, 전부 0 이상 정수 픽셀 (w, h는 1 이상), 원본 이미지 기준
  ※ InsightFace의 face.bbox는 [x1, y1, x2, y2] 모서리 좌표 → x=x1, y=y1, w=x2-x1, h=y2-y1로 바꿔서 정수로 저장
- embedding: 512차원, 길이(L2 norm) 1로 정규화
  ※ InsightFace는 face.embedding(정규화 전)이 아니라 face.normed_embedding을 써야 함
"""

from collections.abc import Sequence

import numpy

EMBEDDING_DIMENSION = 512
BOUNDING_BOX_KEYS = frozenset({"x", "y", "w", "h"})
# float32 반올림 오차 정도는 허용. 정규화를 아예 안 한 벡터(보통 길이 20~30)는 확실히 걸러짐
NORM_TOLERANCE = 1e-3


class FaceContractError(ValueError):
    # 계약 위반. 메시지에 어떤 값이 왜 틀렸는지 담아서 워커 로그만 보고 원인을 알 수 있게 함
    pass


def validate_face_record(bounding_box: dict, embedding: Sequence[float] | numpy.ndarray) -> None:
    """얼굴 1개 분량의 값이 계약을 지키는지 검사. 맞으면 아무것도 반환하지 않고, 틀리면 FaceContractError."""
    validate_bounding_box(bounding_box)
    validate_embedding(embedding)


def validate_bounding_box(bounding_box: dict) -> None:
    if not isinstance(bounding_box, dict) or set(bounding_box) != BOUNDING_BOX_KEYS:
        raise FaceContractError(f"bounding_box는 x, y, w, h 4개 키만 가져야 함: {bounding_box!r}")

    for key, value in bounding_box.items():
        # bool은 파이썬에서 int의 하위 타입(True == 1)이라 따로 막지 않으면 통과해 버림
        if isinstance(value, bool) or not isinstance(value, int):
            raise FaceContractError(f"bounding_box.{key}는 정수여야 함: {value!r}")
        if value < 0:
            raise FaceContractError(f"bounding_box.{key}는 0 이상이어야 함: {value!r}")

    if bounding_box["w"] == 0 or bounding_box["h"] == 0:
        raise FaceContractError(f"bounding_box의 w, h는 1 이상이어야 함: {bounding_box!r}")


def validate_embedding(embedding: Sequence[float] | numpy.ndarray) -> None:
    embedding_array = numpy.asarray(embedding, dtype=float)

    if embedding_array.shape != (EMBEDDING_DIMENSION,):
        raise FaceContractError(f"embedding은 {EMBEDDING_DIMENSION}차원이어야 함: shape={embedding_array.shape}")
    if not numpy.all(numpy.isfinite(embedding_array)):
        raise FaceContractError("embedding에 NaN 또는 무한대 값이 있음")

    embedding_norm = float(numpy.linalg.norm(embedding_array))
    if abs(embedding_norm - 1.0) > NORM_TOLERANCE:
        raise FaceContractError(f"embedding은 길이 1로 정규화돼야 함: 현재 길이={embedding_norm:.4f}")
