# Gallagher Collection Person Dataset(사진 589장, 얼굴 931개, 32명)을 backend/datasets/gallagher/에 내려받음
# 팀원 각자 실행해서 받는 용도: 데이터셋 약관상 사진을 다른 사람에게 넘기거나 인터넷(레포 포함)에 올리면 안 됨
#   출처·약관: http://chenlab.ece.cornell.edu/people/Andy/GallagherDataset.html (비상업 연구용, 재배포 금지)
# 실행: backend/에서 uv run python -m extraction.experiments.download_gallagher_dataset
# 다시 실행하면 이미 받은 사진은 건너뛰고 빠진 것만 받음 (중간에 멈춰도 이어서 받기)
import time
import urllib.request
from pathlib import Path

BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
DATASET_DIRECTORY = BACKEND_DIRECTORY / "datasets" / "gallagher"   # datasets/는 git에서 제외됨
IMAGE_DIRECTORY = DATASET_DIRECTORY / "images"
BASE_URL = "http://chenlab.ece.cornell.edu/people/Andy/"
LIST_FILE_NAMES = ["GallagherDataset.txt", "GallagherDatasetGT.txt"]   # 사진 URL 목록, 정답(눈 좌표·인물 번호)


def download(url: str, path: Path) -> None:
    # 다 받은 뒤에 이름을 바꿔서, 중간에 끊겨도 반쯤 받은 파일이 정상 파일처럼 남지 않게 함
    temporary_path = path.with_name(path.name + ".tmp")
    with urllib.request.urlopen(url, timeout=30) as response:
        temporary_path.write_bytes(response.read())
    temporary_path.replace(path)


IMAGE_DIRECTORY.mkdir(parents=True, exist_ok=True)

# 1) 목록·정답 파일
for list_file_name in LIST_FILE_NAMES:
    list_path = DATASET_DIRECTORY / list_file_name
    if not list_path.exists():
        download(BASE_URL + list_file_name, list_path)
        print("받음:", list_file_name)

# 2) 사진: 목록은 얼굴 1개당 1줄이라 같은 사진 URL이 여러 번 나옴 → 순서를 유지하며 중복 제거
image_urls = list(dict.fromkeys(
    line.strip() for line in (DATASET_DIRECTORY / "GallagherDataset.txt").read_text().splitlines() if line.strip()
))
print(f"사진 {len(image_urls)}장 확인 중 (오래된 대학 서버라 처음엔 몇 분 걸려요)")

downloaded_count, skipped_count, failures = 0, 0, []
for index, image_url in enumerate(image_urls, start=1):
    image_path = IMAGE_DIRECTORY / image_url.rsplit("/", 1)[-1]
    if image_path.exists():
        skipped_count += 1
        continue
    try:
        download(image_url, image_path)
        downloaded_count += 1
    except OSError as error:   # 연결 실패·404·시간 초과 등
        failures.append((image_path.name, str(error)))
    if index % 50 == 0:
        print(f"  {index}/{len(image_urls)}")
    time.sleep(0.2)   # 서버에 부담을 주지 않게 조금씩 쉼

print(f"\n완료: 새로 받음 {downloaded_count}, 이미 있음 {skipped_count}, 실패 {len(failures)}")
for file_name, error in failures[:10]:
    print("  실패:", file_name, error)
if failures:
    print("실패한 사진은 다시 실행하면 이어서 받아요.")
