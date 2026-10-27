-- 같은 행사에 같은 파일 이름 사진은 1행만 (2026-10-27 팀 결정: 같은 이름 = 같은 사진)
-- 업로드 재시도가 원래 요청과 동시에 들어와도 행이 두 개 생기지 않게 DB가 막음 (업로드는 ON CONFLICT로 처리)
-- 새 볼륨: docker compose가 001 다음에 자동 실행
-- 기존 볼륨: backend/에서 아래 명령으로 한 번 적용 (같은 이름 행이 이미 있으면 실패 → 중복 행 정리 후 다시)
--   docker compose exec -T database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/migrations/002_unique_photo_file_name.sql
ALTER TABLE photos
  ADD CONSTRAINT uq_photos_event_file_name UNIQUE (event_id, file_name);
