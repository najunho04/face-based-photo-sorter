# FaceAnalyzer를 실제 InsightFace 모델로 돌려서, 워커가 쓸 결과가 팀 계약(face_contract)을 통과하는지 확인하는 실험
# 실행: backend/에서 uv run python -m extraction.experiments.analyze_one_photo (-m이어야 database·extraction을 import 가능)
import time
from pathlib import Path

from database.face_contract import validate_face_record
from extraction.face_analyzer import FaceAnalyzer, read_image

BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
PHOTO_PATH = BACKEND_DIRECTORY / "datasets" / "gallagher" / "images" / "100_1817.JPG"

model_load_start = time.perf_counter()
face_analyzer = FaceAnalyzer()   # 인자 없이 만들면 실제 buffalo_l 모델을 로드
print(f"모델 로드: {time.perf_counter() - model_load_start:.1f}초")

image = read_image(PHOTO_PATH)
analysis_start = time.perf_counter()
detected_faces = face_analyzer.analyze(image)
print(f"사진 1장 분석: {time.perf_counter() - analysis_start:.2f}초, 원본 크기 {image.shape[1]}x{image.shape[0]}")

for detected_face in detected_faces:
    validate_face_record(detected_face.bounding_box, detected_face.embedding)   # 계약 위반이면 여기서 예외
    print(detected_face.bounding_box, f"점수={detected_face.detection_score:.2f}")
print(f"얼굴 {len(detected_faces)}개, 모두 팀 계약 통과")
