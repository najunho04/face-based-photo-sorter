"""NAS 사진 저장 테스트: 파일 이름 정리, 형식 확인, 저장 경로 (DB 불필요, NAS 대신 임시 폴더)."""

import pytest

from event.photo_storage import detect_image_format, safe_file_name, save_photo_file

JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"jpeg body"
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"png body"


def test_detect_image_format_reads_file_content_not_extension():
    # 확장자·Content-Type은 바꿔 보낼 수 있으니 파일 앞부분(시그니처)으로 판단
    assert detect_image_format(JPEG_BYTES) == "jpeg"
    assert detect_image_format(PNG_BYTES) == "png"
    assert detect_image_format(b"GIF89a....") is None
    assert detect_image_format(b"") is None


@pytest.mark.parametrize("raw_file_name, expected", [
    ("IMG_0001.jpg", "IMG_0001.jpg"),
    ("폴더/IMG_0001.jpg", "IMG_0001.jpg"),
    ("C:\\Users\\admin\\IMG_0001.jpg", "IMG_0001.jpg"),
    ("../../etc/passwd.jpg", "passwd.jpg"),
])
def test_safe_file_name_keeps_only_last_part(raw_file_name, expected):
    # 경로가 섞여 와도 이름만 남겨서 NAS 행사 폴더 밖으로 나가지 못하게 함
    assert safe_file_name(raw_file_name) == expected


@pytest.mark.parametrize("raw_file_name", ["", "..", ".", "폴더/", "a" * 256])
def test_safe_file_name_rejects_unusable_names(raw_file_name):
    assert safe_file_name(raw_file_name) is None


def test_save_photo_file_writes_under_event_folder(tmp_path):
    nas_path = save_photo_file(tmp_path, event_id=7, file_name="IMG_0001.jpg", image_bytes=JPEG_BYTES)

    # DB에는 NAS 루트 기준 상대 경로를 저장 (로컬 ./nas, 운영 /nas 어디서든 워커가 같은 값으로 찾음)
    assert nas_path == "event7/IMG_0001.jpg"
    assert (tmp_path / "event7" / "IMG_0001.jpg").read_bytes() == JPEG_BYTES


def test_save_photo_file_overwrites_same_name_without_leaving_temporary_files(tmp_path):
    # 같은 이름 = 같은 사진(팀 결정)이라 덮어씀. 임시 파일에 쓴 뒤 바꿔치기해서 워커가 반쯤 쓰인 파일을 읽지 않게 함
    save_photo_file(tmp_path, event_id=7, file_name="IMG_0001.jpg", image_bytes=JPEG_BYTES)
    save_photo_file(tmp_path, event_id=7, file_name="IMG_0001.jpg", image_bytes=PNG_BYTES)

    assert (tmp_path / "event7" / "IMG_0001.jpg").read_bytes() == PNG_BYTES
    assert [path.name for path in (tmp_path / "event7").iterdir()] == ["IMG_0001.jpg"]
    # 임시 파일 기본 권한(600)이 아니라 워커가 읽을 수 있는 권한
    assert (tmp_path / "event7" / "IMG_0001.jpg").stat().st_mode & 0o777 == 0o644
