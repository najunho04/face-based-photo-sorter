# Gallagher 사진 1장에 InsightFace 검출 결과와 정답 눈 좌표를 겹쳐 그려서
# 사진 좌표가 정답 파일과 맞는지, 모델이 얼굴을 제대로 찾는지 눈으로 확인하는 실험
from pathlib import Path

import cv2
import numpy as np
from insightface.app import FaceAnalysis

# backend/ 기준 경로 (이 파일은 backend/extraction/experiments/에 있음)
BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
DATASET_DIRECTORY = BACKEND_DIRECTORY / "datasets" / "gallagher"
RESULT_DIRECTORY = DATASET_DIRECTORY / "results"   # datasets/ 아래라 git에서 제외됨

PHOTO_FILE_NAME = "100_1817.JPG"   # 정답 기준 3명(3, 10, 11번)이 있는 사진


def read_image(path: Path) -> np.ndarray:
    # cv2.imread는 Windows 한글 경로를 못 읽어서, 바이트로 읽은 뒤 디코딩
    image_bytes = np.fromfile(path, dtype=np.uint8)
    image = cv2.imdecode(image_bytes, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"이미지를 읽을 수 없음: {path}")
    return image


def write_image(path: Path, image: np.ndarray) -> None:
    # cv2.imwrite도 한글 경로 문제가 있어서, 인코딩한 바이트를 직접 파일로 씀
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imencode(".jpg", image)[1].tofile(path)


def load_ground_truth(photo_file_name: str) -> list[dict]:
    # 정답 파일: 한 줄 = 얼굴 1개, "사진이름 왼눈x 왼눈y 오른눈x 오른눈y 인물번호"
    ground_truth_faces = []
    with open(DATASET_DIRECTORY / "GallagherDatasetGT.txt") as ground_truth_file:
        for line in ground_truth_file:
            columns = line.split()
            if columns and columns[0] == photo_file_name:
                left_x, left_y, right_x, right_y, person_number = map(int, columns[1:6])
                ground_truth_faces.append({
                    "left_eye": (left_x, left_y),
                    "right_eye": (right_x, right_y),
                    "person_number": person_number,
                })
    return ground_truth_faces


ground_truth_faces = load_ground_truth(PHOTO_FILE_NAME)
print("정답 얼굴 수:", len(ground_truth_faces))

image = read_image(DATASET_DIRECTORY / "images" / PHOTO_FILE_NAME)
print("이미지 크기 (높이, 너비, 채널):", image.shape)

# buffalo_l = 얼굴 검출(RetinaFace) + 얼굴 벡터(ArcFace) 등 모델 묶음. GPU 없이 CPU로 실행
face_analysis = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
face_analysis.prepare(ctx_id=-1, det_size=(640, 640))   # ctx_id=-1: CPU, det_size: 검출용 축소 크기

detected_faces = face_analysis.get(image)   # 입력은 BGR 이미지 (cv2로 읽은 그대로)
print("검출 얼굴 수:", len(detected_faces))

result_image = image.copy()

# 정답 눈 좌표: 빨간 점 (OpenCV 색은 BGR 순서라 빨강 = (0, 0, 255))
for ground_truth_face in ground_truth_faces:
    cv2.circle(result_image, ground_truth_face["left_eye"], 14, (0, 0, 255), -1)
    cv2.circle(result_image, ground_truth_face["right_eye"], 14, (0, 0, 255), -1)
    label_position = (ground_truth_face["left_eye"][0], ground_truth_face["left_eye"][1] - 40)
    cv2.putText(result_image, f"GT {ground_truth_face['person_number']}", label_position,
                cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 255), 4)

# InsightFace 결과: 얼굴 박스는 초록, 눈은 파랑 (kps 5개 중 앞의 2개가 보는 사람 기준 왼눈·오른눈)
for face_index, detected_face in enumerate(detected_faces):
    left, top, right, bottom = detected_face.bbox.astype(int)
    cv2.rectangle(result_image, (left, top), (right, bottom), (0, 255, 0), 5)
    for eye_x, eye_y in detected_face.kps[:2].astype(int):
        cv2.circle(result_image, (int(eye_x), int(eye_y)), 7, (255, 0, 0), -1)
    print(f"[{face_index}] 크기={right - left}x{bottom - top}px "
          f"검출점수={detected_face.det_score:.2f} "
          f"눈={detected_face.kps[:2].round().astype(int).tolist()} "
          f"벡터={detected_face.normed_embedding.shape}")

result_path = RESULT_DIRECTORY / "check_one_photo.jpg"
write_image(result_path, result_image)
print("저장:", result_path)
