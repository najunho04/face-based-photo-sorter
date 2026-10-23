# ERD / DB 스키마

> 출처: Notion [백엔드 흐름](https://app.notion.com/p/3fb0ea4df78580f68c86d8936c86967c) (2026-10-23 기준). 원본이 바뀌면 이 문서도 갱신.

DB는 **PostgreSQL + pgvector**. 별도 큐 리소스 없이 `photos.status`를 작업 큐로 쓴다.

## 관계도

```mermaid
erDiagram
    events ||--o{ photos : "업로드된 사진"
    events ||--o{ persons : "분류된 사람"
    events ||--o{ faces : "검출된 얼굴"
    photos ||--o{ faces : "사진 속 얼굴"
    persons |o--o{ faces : "같은 사람으로 묶임"
    persons |o--o| faces : "대표 얼굴 (rep_face_id)"
```

## 상태값

| 컬럼 | 흐름 |
|---|---|
| `events.status` | `uploading` → `extracting` → `clustering` → `open` |
| `photos.status` | `uploaded` → `processing` → `extracted` / `failed` |

- `uploading → extracting`: 관리자가 업로드 완료 API 호출
- `extracting → clustering`: 해당 행사에 `uploaded`·`processing` 사진이 0장 (`failed`는 기다리지 않음)
- `clustering → open`: 분류 완료 + Object Storage 보관 완료

## DDL

```sql
CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector

CREATE TABLE events (
  id           BIGSERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  access_code  VARCHAR(16) UNIQUE NOT NULL,   -- 참가자 인증코드
  status       VARCHAR(20) NOT NULL DEFAULT 'uploading'
);

-- 사진 + 작업 큐 겸용
CREATE TABLE photos (
  id          BIGSERIAL PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(id),
  file_name   VARCHAR(255) NOT NULL,
  nas_path    TEXT NOT NULL,                  -- /nas/event1/IMG_0345.jpg
  object_key  TEXT,                           -- Object Storage 보관 후 채움
  status      VARCHAR(20) NOT NULL DEFAULT 'uploaded',
  worker_id   VARCHAR(50),                    -- 작업을 잡은 워커
  claimed_at  TIMESTAMP                       -- 작업을 잡은 시각 (5분 초과 시 복구)
);

CREATE TABLE persons (
  id           BIGSERIAL PRIMARY KEY,
  event_id     BIGINT NOT NULL REFERENCES events(id),
  label        VARCHAR(50) NOT NULL,          -- 'user1' (폴더명)
  rep_face_id  BIGINT,                        -- 대표 얼굴 (faces.id)
  centroid     VECTOR(512) NOT NULL,          -- 매칭용 평균 벡터 (정규화)
  UNIQUE (event_id, label)
);

CREATE TABLE faces (
  id         BIGSERIAL PRIMARY KEY,
  photo_id   BIGINT NOT NULL REFERENCES photos(id),
  event_id   BIGINT NOT NULL REFERENCES events(id),
  bbox       JSONB NOT NULL,                  -- {"x":..,"y":..,"w":..,"h":..}
  embedding  VECTOR(512) NOT NULL,            -- 얼굴 벡터 (정규화)
  person_id  BIGINT REFERENCES persons(id)    -- 분류 전 NULL
);
```

`persons.rep_face_id`는 FK 제약 없이 둔다 (persons ↔ faces 순환 참조).

## 인덱스

```sql
CREATE INDEX idx_photos_queue  ON photos(status, id);         -- 워커 작업 잡기
CREATE INDEX idx_photos_event  ON photos(event_id, status);   -- 분류 시작 판단
CREATE INDEX idx_faces_event   ON faces(event_id);            -- 분류 시 행사 전체 얼굴 로드
CREATE INDEX idx_faces_person  ON faces(person_id);           -- 사람 폴더 조회
CREATE INDEX idx_faces_photo   ON faces(photo_id);            -- 사진별 얼굴 조회
```

## 워커 큐 규칙 (photos)

1. **작업 잡기**: `status='uploaded'` 1장을 `processing`으로 바꾸며 가져옴 (`worker_id`, `claimed_at` 기록). 여러 워커가 같은 행을 잡지 않도록 `FOR UPDATE SKIP LOCKED` 사용.
2. **완료**: `faces` INSERT + `photos.status='extracted'`를 **한 트랜잭션**으로.
3. **일시 오류**(DB 끊김 등): `status='uploaded'`, `worker_id=NULL`로 되돌림.
4. **워커 사망**: 웹서버가 `claimed_at` 5분 초과 `processing` 행을 3번과 같이 복구.
5. **영구 오류**(파일 없음·손상): `status='failed'`, `worker_id`는 추적용으로 남김. 관리자 화면 실패 목록에 노출.

## 매칭 쿼리

셀카 벡터와 해당 행사 `persons.centroid`의 코사인 유사도 → 기준값 이상 상위 3명.

```sql
SELECT id, label, rep_face_id, 1 - (centroid <=> :selfie) AS sim
FROM persons WHERE event_id = :event_id
ORDER BY centroid <=> :selfie LIMIT 3;
```
