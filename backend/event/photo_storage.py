# 업로드 사진을 NAS에 저장. 워커(B)는 photos.nas_path로 이 파일을 읽음 (경로 규칙: event{eventId}/{fileName})
from pathlib import Path

MAXIMUM_FILE_NAME_LENGTH = 255   # photos.file_name VARCHAR(255)

# 파일 맨 앞 몇 바이트(시그니처)로 형식 판단. 확장자·Content-Type은 보내는 쪽이 마음대로 바꿀 수 있음
IMAGE_SIGNATURES = {
    b"\xff\xd8\xff": "jpeg",
    b"\x89PNG\r\n\x1a\n": "png",
}


def detect_image_format(image_bytes: bytes) -> str | None:
    # jpg·png면 형식 이름, 아니면 None (heic, gif, 이미지가 아닌 파일)
    for signature, image_format in IMAGE_SIGNATURES.items():
        if image_bytes.startswith(signature):
            return image_format
    return None


def safe_file_name(raw_file_name: str) -> str | None:
    # 브라우저에 따라 경로가 섞여 올 수 있어("C:\...\IMG.jpg", "../x.jpg") 마지막 이름만 남김
    # → 행사 폴더 밖에 파일을 쓰지 못하게 막음. 쓸 수 없는 이름이면 None
    file_name = raw_file_name.replace("\\", "/").rsplit("/", 1)[-1].strip()
    if file_name in ("", ".", "..") or len(file_name) > MAXIMUM_FILE_NAME_LENGTH:
        return None
    return file_name


def save_photo_file(nas_root_path: str | Path, event_id: int, file_name: str, image_bytes: bytes) -> str:
    # NAS 루트 기준 상대 경로를 반환해서 DB에 저장 (로컬 ./nas, 운영 /nas 어디서든 같은 값)
    # 리턴은 상대경로(event7/IMG_0001.jpg). file_path로 ./nas/event7/IMG_0001.jpg에 저장까지.
    # 같은 이름 파일은 덮어씀 (팀 결정: 한 행사 안에서 파일 이름이 겹치는 경우는 고려하지 않음)
    nas_path = f"event{event_id}/{file_name}"
    file_path = Path(nas_root_path) / nas_path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(image_bytes)
    return nas_path
