# Gallagher 사진을 실험용 행사의 photos(status='uploaded')로 등록 → 워커가 처리할 대기열을 만듦
# 업로드 API(팀원 담당)가 아직 없어서, 업로드가 끝난 상태를 DB에 직접 만들어 워커만 따로 검증하는 용도
# 실행: backend/에서 uv run python -m extraction.experiments.register_gallagher_photos [--photo-count 100]
# 다시 실행하면 이전 실험 데이터(이 행사의 faces·persons·photos)를 지우고 처음부터 새로 등록
import argparse
from collections import Counter, defaultdict
from pathlib import Path

from sqlalchemy import delete, select

from database.connection import database_session_scope
from database.models import Event, EventStatus, Face, Person, Photo

BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
DATASET_DIRECTORY = BACKEND_DIRECTORY / "datasets" / "gallagher"
IMAGE_DIRECTORY = DATASET_DIRECTORY / "images"
EXPERIMENT_ACCESS_CODE = "GALLAGHER"   # 실험용 행사를 찾는 표시 (events.access_code는 UNIQUE)
FREQUENT_PEOPLE_COUNT = 8              # 사진에 많이 나오는 상위 8명을 "자주 겹치는 사람"으로 봄


def load_people_per_photo() -> dict[str, list[int]]:
    # 정답 파일: 한 줄 = 얼굴 1개, 마지막 열이 인물 번호 → 사진별 등장 인물 목록
    people_per_photo = defaultdict(list)
    with open(DATASET_DIRECTORY / "GallagherDatasetGT.txt") as ground_truth_file:
        for line in ground_truth_file:
            columns = line.split()
            if len(columns) >= 6:
                people_per_photo[columns[0]].append(int(columns[5]))
    return people_per_photo


def select_photos_with_most_shared_people(photo_count: int) -> list[str]:
    # 분류 실험이 의미 있으려면 같은 사람이 여러 사진에 반복해서 나와야 함
    # → 자주 나오는 사람이 많이 찍힌 사진부터, 같으면 얼굴이 많은 단체 사진부터 고름
    people_per_photo = load_people_per_photo()
    appearance_counts = Counter(person for people in people_per_photo.values() for person in people)
    frequent_people = {person for person, _ in appearance_counts.most_common(FREQUENT_PEOPLE_COUNT)}

    def shared_people_score(photo_file_name: str) -> tuple[int, int]:
        people = people_per_photo[photo_file_name]
        return (sum(person in frequent_people for person in people), len(people))

    ranked_photo_file_names = sorted(people_per_photo, key=shared_people_score, reverse=True)
    return sorted(ranked_photo_file_names[:photo_count])


def print_selection_summary(photo_file_names: list[str]) -> None:
    people_per_photo = load_people_per_photo()
    selected_appearances = Counter(person for name in photo_file_names for person in people_per_photo[name])
    print(f"정답 기준 얼굴 {sum(selected_appearances.values())}개, 인물 {len(selected_appearances)}명")
    print("많이 나오는 인물 (인물 번호: 사진 수):", selected_appearances.most_common(8))


argument_parser = argparse.ArgumentParser()
argument_parser.add_argument("--photo-count", type=int, default=100, help="등록할 사진 수 (0이면 전체 589장)")
arguments = argument_parser.parse_args()

if arguments.photo_count > 0:
    photo_file_names = select_photos_with_most_shared_people(arguments.photo_count)
else:
    photo_file_names = sorted(load_people_per_photo())
print_selection_summary(photo_file_names)

with database_session_scope() as database_session:
    event = database_session.scalars(select(Event).where(Event.access_code == EXPERIMENT_ACCESS_CODE)).first()
    if event is None:
        event = Event(name="Gallagher 실험", access_code=EXPERIMENT_ACCESS_CODE)
        database_session.add(event)
        database_session.flush()
    else:
        # 이전 실험 결과 정리 (FK 순서: faces → persons → photos)
        database_session.execute(delete(Face).where(Face.event_id == event.id))
        database_session.execute(delete(Person).where(Person.event_id == event.id))
        database_session.execute(delete(Photo).where(Photo.event_id == event.id))

    event.status = EventStatus.EXTRACTING   # 업로드 완료 상태
    # 사진은 레포의 datasets/ 아래에 있어서 절대 경로로 등록 (워커는 절대·상대 경로 모두 읽음)
    database_session.add_all([
        Photo(event_id=event.id, file_name=file_name, nas_path=str(IMAGE_DIRECTORY / file_name))
        for file_name in photo_file_names
    ])
    print(f"행사 id={event.id}에 사진 {len(photo_file_names)}장 등록 (status=uploaded)")
