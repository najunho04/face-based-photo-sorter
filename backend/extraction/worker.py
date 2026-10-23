# 얼굴 추출 워커: photos 대기열에서 사진을 잡아 얼굴을 분석하고 faces에 저장하는 일을 반복 (처리 2)
# 한 장 처리 = [트랜잭션] 잡기 → [밖] NAS에서 읽기·분석 → [트랜잭션] 저장 (오래 걸리는 분석 중에 DB를 붙잡지 않음)
import logging
import time
from contextlib import AbstractContextManager
from collections.abc import Callable
from pathlib import Path

from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from database.connection import database_session_scope
from extraction.face_analyzer import ImageReadError, read_image
from extraction.photo_queue import (
    claim_next_photo,
    complete_photo,
    mark_photo_failed,
    release_photo_for_retry,
)

logger = logging.getLogger(__name__)

IDLE_SECONDS = 3   # 대기열이 비었을 때 다시 확인하기까지 쉬는 시간 (설계의 "N초마다 반복")


class ExtractionWorker:
    def __init__(
        self,
        face_analyzer,
        worker_id: str,
        nas_root_path: str,
        session_scope: Callable[[], AbstractContextManager[Session]] = database_session_scope,
        idle_seconds: float = IDLE_SECONDS,
    ):
        # face_analyzer: 실제로는 FaceAnalyzer (모델은 워커 프로세스당 한 번만 로드), 테스트에서는 가짜
        # session_scope: with 블록 하나 = 트랜잭션 하나 (팀 공용 database_session_scope). 테스트에서는 롤백되는 세션
        self.face_analyzer = face_analyzer
        self.worker_id = worker_id
        self.nas_root_path = Path(nas_root_path)
        self.session_scope = session_scope
        self.idle_seconds = idle_seconds
        self.is_stop_requested = False

    def request_stop(self) -> None:
        # 종료 신호(SIGTERM 등)를 받으면 호출: 지금 사진은 끝까지 처리하고, 다음 사진은 잡지 않음
        self.is_stop_requested = True

    def resolve_image_path(self, nas_path: str) -> Path:
        # 절대 경로는 그대로, 상대 경로(event1/IMG.jpg)는 NAS 루트(로컬 ./nas, 운영 /nas) 아래에서 찾음
        path = Path(nas_path)
        return path if path.is_absolute() else self.nas_root_path / path

    def process_one_photo(self) -> bool:
        """사진 1장을 처리. 처리할 사진이 없으면 False, 성공이든 실패든 1장을 끝냈으면 True."""
        # [트랜잭션 1] 잡기: with 블록이 끝나면 커밋돼서 다른 워커에게 processing이 보이고 lock도 풀림
        with self.session_scope() as database_session:
            photo = claim_next_photo(database_session, self.worker_id)
            if photo is None:
                return False
            photo_id, nas_path = photo.id, photo.nas_path

        # [트랜잭션 밖] NAS에서 읽기 + 얼굴 분석 (사진 1장에 1초 안팎)
        try:
            image = read_image(self.resolve_image_path(nas_path))
            detected_faces = self.face_analyzer.analyze(image)
        except ImageReadError as error:
            # 영구 오류: 파일 없음·손상 → 다시 해도 안 되므로 failed
            logger.warning("사진을 읽을 수 없어 failed 처리: photo_id=%s, %s", photo_id, error)
            self.mark_failed_safely(photo_id)
            return True
        except Exception:
            # 분석 중 예상 못한 오류: 다시 대기열에 넣으면 같은 사진에서 계속 실패할 수 있어 failed (무한 반복 방지)
            logger.exception("얼굴 분석 중 오류로 failed 처리: photo_id=%s", photo_id)
            self.mark_failed_safely(photo_id)
            return True

        # [트랜잭션 2] 저장: faces INSERT + extracted가 함께 커밋되거나 함께 롤백됨
        try:
            with self.session_scope() as database_session:
                is_completed = complete_photo(database_session, photo_id, self.worker_id, detected_faces)
            if not is_completed:
                logger.warning("처리 중 다른 워커에게 넘어간 사진이라 결과를 버림: photo_id=%s", photo_id)
        except OperationalError:
            # 일시 오류(DB 끊김 등): 다시 대기열로 돌려서 나중에 아무 워커나 처리
            logger.exception("DB 오류로 저장 실패, 대기열로 되돌림: photo_id=%s", photo_id)
            self.release_for_retry_safely(photo_id)
        return True

    def mark_failed_safely(self, photo_id: int) -> None:
        # failed 표시조차 DB 오류로 실패하면 로그만 남김 → processing으로 남은 사진은 웹서버의 5분 복구가 처리
        try:
            with self.session_scope() as database_session:
                mark_photo_failed(database_session, photo_id)
        except OperationalError:
            logger.exception("failed 표시 실패: photo_id=%s", photo_id)

    def release_for_retry_safely(self, photo_id: int) -> None:
        # DB가 아직 끊겨 있으면 되돌리기도 실패할 수 있음 → 로그만 남기고 5분 복구에 맡김
        try:
            with self.session_scope() as database_session:
                release_photo_for_retry(database_session, photo_id)
        except OperationalError:
            logger.exception("대기열 되돌리기 실패: photo_id=%s", photo_id)

    def run(self, stop_when_queue_empty: bool = False) -> int:
        """멈춤 요청이 올 때까지 사진을 처리. 처리한 장수를 돌려줌.

        stop_when_queue_empty=True: 대기열이 비면 종료 (실험·부하 테스트용)
        """
        processed_count = 0
        while not self.is_stop_requested:
            try:
                has_processed = self.process_one_photo()
            except OperationalError:
                # 잡기 단계에서 DB 연결 실패: 잠깐 쉬고 다시 시도 (DB가 돌아오면 자동으로 이어서 처리)
                logger.exception("DB 연결 실패, %s초 후 다시 시도", self.idle_seconds)
                has_processed = False

            if has_processed:
                processed_count += 1
                continue
            if stop_when_queue_empty:
                break
            time.sleep(self.idle_seconds)
        return processed_count
