-- 초기 스키마. docs/erd.md와 동일하게 유지 (바꿀 땐 erd.md·Notion 먼저 수정)
-- docker compose가 빈 볼륨으로 처음 뜰 때 자동 실행됨

-- 얼굴 벡터(VECTOR 타입)와 코사인 거리 연산자(<=>)를 쓰기 위한 확장
CREATE EXTENSION IF NOT EXISTS vector;

-- 행사: 참가자는 access_code로 입장, status로 처리 단계 추적
CREATE TABLE events (
  id           BIGSERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  access_code  VARCHAR(16) UNIQUE NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'uploading'
               -- uploading → extracting → clustering → open
);

-- 사진 + 작업 큐 겸용: 워커가 status='uploaded' 행을 잡아 처리
CREATE TABLE photos (
  id          BIGSERIAL PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(id),
  file_name   VARCHAR(255) NOT NULL,
  nas_path    TEXT NOT NULL,                  -- event1/IMG_0345.jpg (NAS_ROOT_PATH 기준 상대 경로)
  object_key  TEXT,                           -- Object Storage 보관 후 채움
  status      VARCHAR(20) NOT NULL DEFAULT 'uploaded',
              -- uploaded → processing → extracted / failed
  worker_id   VARCHAR(50),                    -- 작업을 잡은 워커
  claimed_at  TIMESTAMP                       -- 작업을 잡은 시각 (5분 초과 시 복구)
);

-- 분류된 사람 = 사람 폴더. centroid는 셀카 매칭용 평균 벡터
CREATE TABLE persons (
  id           BIGSERIAL PRIMARY KEY,
  event_id     BIGINT NOT NULL REFERENCES events(id),
  label        VARCHAR(50) NOT NULL,          -- 'user1' (폴더명)
  rep_face_id  BIGINT,                        -- 대표 얼굴 (faces ↔ persons 순환 참조라 FK 생략)
  centroid     VECTOR(512) NOT NULL,          -- 정규화된 평균 벡터
  UNIQUE (event_id, label)
);

-- 사진에서 검출된 얼굴. person_id는 분류 후 채움
CREATE TABLE faces (
  id         BIGSERIAL PRIMARY KEY,
  photo_id   BIGINT NOT NULL REFERENCES photos(id),
  event_id   BIGINT NOT NULL REFERENCES events(id),
  bbox       JSONB NOT NULL,                  -- {"x":..,"y":..,"w":..,"h":..}
  embedding  VECTOR(512) NOT NULL,            -- 정규화된 얼굴 벡터
  person_id  BIGINT REFERENCES persons(id)    -- 분류 전 NULL
);

-- 워커가 작업 잡을 때: WHERE status='uploaded' ORDER BY id
CREATE INDEX idx_photos_queue  ON photos(status, id);
-- 분류 시작 판단: WHERE event_id=? AND status IN ('uploaded','processing')
CREATE INDEX idx_photos_event  ON photos(event_id, status);
-- 분류할 때 행사 전체 얼굴 로드: WHERE event_id=?
CREATE INDEX idx_faces_event   ON faces(event_id);
-- 사람 폴더 조회: WHERE person_id=?
CREATE INDEX idx_faces_person  ON faces(person_id);
-- 사진별 얼굴 조회: WHERE photo_id=?
CREATE INDEX idx_faces_photo   ON faces(photo_id);
