# 관리자 행사 처리 (API 2~5). HTTP(요청 검사, 응답 모양)는 router.py가 맡고, 여기는 순서와 상태 규칙만 담당
import secrets
import string
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.error_codes import ApplicationError, ErrorCode
from database.models import Event, EventStatus, Person, Photo, PhotoStatus
from event.photo_storage import detect_image_format, safe_file_name, save_photo_file

ACCESS_CODE_LENGTH = 6                                          # 명세 예시 A7K2Q9
ACCESS_CODE_CHARACTERS = string.ascii_uppercase + string.digits # 입장 API의 정규화 결과(대문자·숫자)와 같은 모양
MAXIMUM_ACCESS_CODE_ATTEMPTS = 10                               # 36^6 ≈ 21억 개라 겹칠 일은 거의 없음


@dataclass(frozen=True)
class ReceivedPhotoFile:
    # 업로드 받은 파일 1개 (FastAPI UploadFile에서 이름과 내용만 꺼낸 것 → DB·NAS만으로 테스트 가능)
    file_name: str
    image_bytes: bytes | None   # 용량 초과로 끝까지 읽지 않은 파일은 None


@dataclass(frozen=True)
class UploadFailure:
    file_name: str
    reason: ErrorCode


@dataclass(frozen=True)
class UploadResult:
    uploaded_count: int
    failures: list[UploadFailure]


@dataclass(frozen=True)
class EventProgress:
    event: Event
    photo_count_by_status: dict[PhotoStatus, int]
    person_count: int | None
    failed_photos: list[Photo]


def generate_access_code() -> str:
    # secrets: 다음 코드를 추측할 수 없는 난수 (random 모듈은 예측 가능)
    return "".join(secrets.choice(ACCESS_CODE_CHARACTERS) for _ in range(ACCESS_CODE_LENGTH))


def create_event(database_session: Session, name: str) -> Event:
    # 인증코드는 행사끼리 겹치면 안 되므로 이미 쓰는 코드면 다시 뽑음
    for _ in range(MAXIMUM_ACCESS_CODE_ATTEMPTS):
        access_code = generate_access_code()
        is_taken = database_session.scalar(select(Event.id).where(Event.access_code == access_code)) is not None
        if not is_taken:
            break
    else:
        raise RuntimeError("인증코드를 만들지 못했습니다.")   # 공통 핸들러가 INTERNAL_ERROR로 응답

    event = Event(name=name, access_code=access_code, status=EventStatus.UPLOADING)
    database_session.add(event)
    database_session.commit()
    return event


def find_event_for_update(database_session: Session, event_id: int, for_share: bool = False) -> Event:
    # 행사 행에 잠금을 걸고 읽음 (커밋할 때 풀림)
    # - 업로드: FOR SHARE → 업로드끼리는 동시에 진행, 업로드 완료(FOR UPDATE)는 진행 중인 업로드가 끝날 때까지 대기
    # - 업로드 완료: FOR UPDATE → 완료 처리와 동시에 들어온 업로드는 완료 후 상태를 보고 INVALID_STATUS
    # 이렇게 해야 extracting으로 바뀐 뒤에 사진이 끼어들어 분류에서 빠지는 일이 없음
    event = database_session.scalars(
        select(Event).where(Event.id == event_id).with_for_update(read=for_share)
    ).one_or_none()
    if event is None:
        raise ApplicationError(ErrorCode.EVENT_NOT_FOUND)
    return event


def upload_photos(
    database_session: Session,
    event_id: int,
    upload_files: list[ReceivedPhotoFile],
    nas_root_path: str,
) -> UploadResult:
    event = find_event_for_update(database_session, event_id, for_share=True)
    if event.status != EventStatus.UPLOADING:
        raise ApplicationError(ErrorCode.INVALID_STATUS)   # 업로드 완료 후 추가 업로드

    # 파일 하나가 잘못돼도 나머지는 저장 (명세: 파일 단위 실패는 failed에 담음)
    failures = []
    uploaded_count = 0
    for upload_file in upload_files:
        file_name = safe_file_name(upload_file.file_name)
        if upload_file.image_bytes is None:
            failures.append(UploadFailure(upload_file.file_name, ErrorCode.FILE_TOO_LARGE))
        elif file_name is None or detect_image_format(upload_file.image_bytes) is None:
            failures.append(UploadFailure(upload_file.file_name, ErrorCode.UNSUPPORTED_FILE))
        else:
            nas_path = save_photo_file(nas_root_path, event.id, file_name, upload_file.image_bytes)
            # status=uploaded: 워커가 이 행을 잡아서 얼굴을 추출함 (docs/erd.md 워커 큐 규칙)
            database_session.add(Photo(event_id=event.id, file_name=file_name, nas_path=nas_path, status=PhotoStatus.UPLOADED))
            uploaded_count += 1
    database_session.commit()
    return UploadResult(uploaded_count=uploaded_count, failures=failures)


def complete_upload(database_session: Session, event_id: int) -> tuple[Event, int]:
    # uploading → extracting. 이후 업로드는 막히고, 워커 처리가 끝나면 분류(5단계)가 시작됨
    event = find_event_for_update(database_session, event_id)
    if event.status != EventStatus.UPLOADING:
        raise ApplicationError(ErrorCode.INVALID_STATUS)   # 이미 완료한 행사
    total_photo_count = database_session.scalar(select(func.count()).where(Photo.event_id == event.id))
    if total_photo_count == 0:
        raise ApplicationError(ErrorCode.INVALID_STATUS)   # 사진 0장이면 분류할 것이 없어 extracting에서 멈춤

    event.status = EventStatus.EXTRACTING
    database_session.commit()
    return event, total_photo_count


def get_event_progress(database_session: Session, event_id: int) -> EventProgress:
    # 관리자 화면이 몇 초마다 부르므로 상태별 개수는 GROUP BY 한 번으로 셈
    event = database_session.get(Event, event_id)
    if event is None:
        raise ApplicationError(ErrorCode.EVENT_NOT_FOUND)

    photo_count_by_status = dict(database_session.execute(
        select(Photo.status, func.count()).where(Photo.event_id == event.id).group_by(Photo.status)
    ).all())
    failed_photos = list(database_session.scalars(
        select(Photo).where(Photo.event_id == event.id, Photo.status == PhotoStatus.FAILED).order_by(Photo.id)
    ))
    # 사람 수는 분류가 끝난(open) 뒤에만 의미 있음. 그 전에는 null
    person_count = None
    if event.status == EventStatus.OPEN:
        person_count = database_session.scalar(select(func.count()).where(Person.event_id == event.id))
    return EventProgress(event=event, photo_count_by_status=photo_count_by_status,
                         person_count=person_count, failed_photos=failed_photos)
