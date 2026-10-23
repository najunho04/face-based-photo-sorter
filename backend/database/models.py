"""테이블 4개에 대응하는 SQLAlchemy 모델 (Spring의 @Entity에 해당).

규칙
- 스키마의 기준은 migrations/001_initial_schema.sql. 여기서 Base.metadata.create_all()로 테이블을 만들지 않음
  → 모델과 SQL이 어긋나면 tests/database/test_database_models.py가 잡아냄
- 파이썬 속성은 풀네임, DB 컬럼명은 ERD 그대로
  (예: 속성 bounding_box ↔ 컬럼 bbox, 속성 representative_face_id ↔ 컬럼 rep_face_id)

관계 한눈에 보기
    Event 1 ── N Photo 1 ── N Face N ── 1 Person
      │                         │          │
      └──────── N ──────────────┘          └─ representative_face → Face (FK 없이 id만 저장)
"""

from datetime import datetime
from enum import StrEnum

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from database.face_contract import EMBEDDING_DIMENSION


class Base(DeclarativeBase):
    # 모든 모델의 부모. metadata에 테이블 정의가 모여 스키마 비교 테스트에 쓰임
    pass


class EventStatus(StrEnum):
    # 행사 처리 단계. uploading → extracting → clustering → open (docs/erd.md 상태값)
    UPLOADING = "uploading"    # 관리자가 사진을 올리는 중
    EXTRACTING = "extracting"  # 업로드 완료, 워커가 얼굴 추출 중
    CLUSTERING = "clustering"  # 추출 끝, 웹서버가 사람별로 분류 중
    OPEN = "open"              # 분류·보관 완료, 참가자 조회 가능


class PhotoStatus(StrEnum):
    # 사진 = 작업 큐 한 칸. uploaded → processing → extracted / failed
    UPLOADED = "uploaded"      # 워커가 가져가길 기다리는 중
    PROCESSING = "processing"  # 워커가 잡아서 처리 중 (worker_id, claimed_at 기록됨)
    EXTRACTED = "extracted"    # 얼굴 추출 완료 (faces 저장됨)
    FAILED = "failed"          # 파일 없음·손상 등 영구 오류. 분류는 이 사진을 기다리지 않음


def status_column_type(status_enum: type[StrEnum]) -> Enum:
    # DB 컬럼은 VARCHAR(20)이고 'uploaded' 같은 소문자 값이 그대로 들어가야 함
    # native_enum=False: PostgreSQL ENUM 타입을 쓰지 않음 (스키마 SQL과 일치)
    # values_callable: 멤버 이름(UPLOADED)이 아니라 값(uploaded)을 저장
    # create_constraint=False: 스키마 SQL에 없는 CHECK 제약을 만들지 않음
    return Enum(
        status_enum,
        native_enum=False,
        create_constraint=False,
        length=20,
        values_callable=lambda enum_class: [member.value for member in enum_class],
    )


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    access_code: Mapped[str] = mapped_column(String(16), unique=True)  # 참가자 입장용 인증코드 (QR 값)
    status: Mapped[EventStatus] = mapped_column(status_column_type(EventStatus), default=EventStatus.UPLOADING)

    # 행사에 속한 사진·사람·얼굴. order_by로 항상 id 순서로 읽힘
    photos: Mapped[list["Photo"]] = relationship(back_populates="event", order_by="Photo.id")
    persons: Mapped[list["Person"]] = relationship(back_populates="event", order_by="Person.id")
    faces: Mapped[list["Face"]] = relationship(back_populates="event", order_by="Face.id")


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    file_name: Mapped[str] = mapped_column(String(255))
    nas_path: Mapped[str] = mapped_column(Text)                       # 워커가 이 경로에서 이미지를 읽음
    object_key: Mapped[str | None] = mapped_column(Text)              # Object Storage 보관 후 채움 (처리 4)
    status: Mapped[PhotoStatus] = mapped_column(status_column_type(PhotoStatus), default=PhotoStatus.UPLOADED)
    worker_id: Mapped[str | None] = mapped_column(String(50))         # 작업을 잡은 워커 (실패 추적용으로 남김)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime)     # 작업을 잡은 시각 (5분 넘으면 복구 대상)

    event: Mapped[Event] = relationship(back_populates="photos")
    faces: Mapped[list["Face"]] = relationship(back_populates="photo", order_by="Face.id")


class Person(Base):
    # 분류된 사람 1명 = 사람 폴더 1개. 폴더를 실제로 복사하지 않고 faces.person_id로 묶음
    __tablename__ = "persons"
    __table_args__ = (UniqueConstraint("event_id", "label"),)  # 같은 행사 안에서 폴더명 중복 금지

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    label: Mapped[str] = mapped_column(String(50))                    # 폴더명 ('user1', 'user2', ...)
    # 대표 얼굴. persons ↔ faces가 서로를 가리키는 순환 참조라 DB FK 없이 id만 저장
    representative_face_id: Mapped[int | None] = mapped_column("rep_face_id", BigInteger)
    # 소속 얼굴 벡터들의 평균(정규화). 셀카 매칭 때 이 값과 비교
    centroid: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIMENSION))

    event: Mapped[Event] = relationship(back_populates="persons")
    faces: Mapped[list["Face"]] = relationship(back_populates="person", order_by="Face.id")
    # FK가 없어서 조인 조건을 직접 지정. foreign()은 "이 컬럼이 상대를 가리키는 쪽"이라는 표시
    # viewonly=True: 읽기 전용. 대표 얼굴을 바꿀 땐 representative_face_id에 id를 넣음
    representative_face: Mapped["Face | None"] = relationship(
        primaryjoin="foreign(Person.representative_face_id) == Face.id",
        viewonly=True,
    )


class Face(Base):
    # 사진에서 검출된 얼굴 1개. 워커(B)가 만들고, 분류(A)가 person_id를 채움
    __tablename__ = "faces"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    photo_id: Mapped[int] = mapped_column(ForeignKey("photos.id"))
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))    # 행사 단위 조회를 조인 없이 하려고 중복 저장
    # 얼굴 위치 {"x","y","w","h"} 정수 픽셀. 형식은 face_contract.validate_face_record로 검증
    bounding_box: Mapped[dict] = mapped_column("bbox", JSONB)
    # 얼굴 벡터 512차원, 길이 1로 정규화. DB에서 읽으면 numpy 배열로 돌아옴
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIMENSION))
    person_id: Mapped[int | None] = mapped_column(ForeignKey("persons.id"))  # 분류 전에는 None

    event: Mapped[Event] = relationship(back_populates="faces")
    photo: Mapped[Photo] = relationship(back_populates="faces")
    person: Mapped[Person | None] = relationship(back_populates="faces")
