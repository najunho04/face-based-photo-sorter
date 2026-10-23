# 셀카에서 매칭에 쓸 얼굴 1개를 고름 (API 8 셀카 매칭의 첫 단계)
from core.error_codes import ApplicationError, ErrorCode
from extraction.face_analyzer import DetectedFace


def select_selfie_face(detected_faces: list[DetectedFace]) -> DetectedFace:
    # 얼굴이 없으면 422 FACE_NOT_DETECTED → 프론트가 "다시 찍어 주세요" 안내
    if not detected_faces:
        raise ApplicationError(ErrorCode.FACE_NOT_DETECTED)
    # 셀카는 찍는 사람 얼굴이 가장 크게 나오므로, 뒤에 지나가던 사람이 아니라 넓이가 가장 큰 얼굴을 씀
    return max(detected_faces, key=lambda face: face.bounding_box["w"] * face.bounding_box["h"])
