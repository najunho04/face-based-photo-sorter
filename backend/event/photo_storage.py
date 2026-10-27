# 업로드 사진을 NAS에 저장. 워커(B)는 photos.nas_path로 이 파일을 읽음 (경로 규칙: event{eventId}/{fileName})
import os
import tempfile
from pathlib import Path

MAXIMUM_FILE_NAME_LENGTH = 255   # photos.file_name VARCHAR(255)
PHOTO_FILE_MODE = 0o644          # 소유자 쓰기, 모두 읽기 (워커가 다른 계정이어도 읽음)

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
    # 같은 이름 파일은 덮어씀 (팀 결정: 같은 이름 = 같은 사진, 업로드 재시도도 여기로 옴)
    nas_path = f"event{event_id}/{file_name}"
    file_path = Path(nas_root_path) / nas_path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    # 임시 파일에 다 쓴 뒤 이름을 바꿔치기(os.replace는 한 번에 바뀜)
    # → 덮어쓰는 도중에 워커가 반쯤 쓰인 파일을 읽지 않음. 임시 이름은 요청끼리 겹치지 않게 무작위
    with tempfile.NamedTemporaryFile(dir=file_path.parent, prefix=".uploading-", delete=False) as temporary_file:
        temporary_path = Path(temporary_file.name)
        try:
            temporary_file.write(image_bytes)
        except BaseException:
            temporary_file.close()
            temporary_path.unlink(missing_ok=True)   # 쓰다 실패하면 임시 파일을 남기지 않음
            raise
    # 임시 파일은 소유자만 읽을 수 있게(600) 만들어짐 → 다른 서버·계정의 워커도 읽게 일반 파일 권한으로
    temporary_path.chmod(PHOTO_FILE_MODE)
    os.replace(temporary_path, file_path)
    return nas_path
