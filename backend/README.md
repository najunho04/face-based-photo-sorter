# 백엔드

FastAPI + PostgreSQL(pgvector) + InsightFace. 프론트 개발에 필요한 것만 정리했어요. API 모양은 [docs/api.md](../docs/api.md), DB·처리 규칙은 [docs/erd.md](../docs/erd.md)가 기준이에요.

## 실행되는 것 3개

같은 코드에서 시작 명령만 다른 프로그램 2개 + DB. 둘은 서로 호출하지 않고 DB(`photos.status`)를 작업 대기열로 같이 써요.

| 프로그램 | 실행 (backend/에서) | 하는 일 |
|---|---|---|
| DB | `docker compose up -d` | PostgreSQL 16 + pgvector. 첫 실행 때 스키마 자동 생성 |
| API 서버 | `uv run uvicorn main:application --reload` | API 1~10 + **분류 스케줄러**(5초마다: 멈춘 사진 복구, 추출 끝난 행사 분류 → Object Storage 보관 → `open`) |
| 워커 | `uv run python -m extraction.worker` | 업로드된 사진에서 얼굴 검출·벡터 추출 → `faces` 저장. 여러 개 띄워도 됨 |

워커를 안 띄우면 행사가 `extracting`에서 멈춰요. API 서버도 셀카 매칭(API 8) 때문에 얼굴 분석 모델을 씀 (첫 요청 때 몇 초 로드, 모델 파일은 첫 실행 때 자동 다운로드).

배포에서는 API 서버와 워커를 따로 띄우는 구성이에요 (늘리는 기준이 다름: 워커는 사진 양, API는 접속자 수). 둘 다 같은 DB와 같은 NAS를 봐야 해요.

## 로컬에서 처음 띄우기

```bash
cd backend
uv sync                  # Python 3.12 + 의존성 (uv.lock 기준)
cp .env.example .env     # 로컬 값 그대로 써도 됨. Object Storage 버킷·키는 아래 참고
docker compose up -d
uv run uvicorn main:application --reload       # 터미널 1: http://localhost:8000/docs 에서 API 시험
uv run python -m extraction.worker             # 터미널 2
uv run pytest                                  # 테스트 (DB 필요)
```

이미 DB 볼륨이 있으면 새 마이그레이션은 자동 적용되지 않아요 (`docker-entrypoint-initdb.d`는 빈 볼륨일 때만 실행). 새 `.sql`이 생기면 아래처럼 한 번 적용하거나, 데이터를 버려도 되면 `docker compose down -v && docker compose up -d`.

```bash
# 예: 002 (같은 행사·같은 파일 이름 1행 제약, 2026-10-27)
docker compose exec -T database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/migrations/002_unique_photo_file_name.sql
```

프론트는 `frontend/.env.development.local`에 `VITE_USE_MOCK=false`를 두면 Vite 개발 서버가 `/api`를 `localhost:8000`으로 넘겨줘요 (로컬에서는 백엔드 CORS 불필요).

### Object Storage (NCP)

사진 URL은 전부 Object Storage Pre-signed URL이에요. 개발용 NCP 버킷 이름과 키를 받아 `.env`에 넣으면 돼요 (키는 채팅·커밋 금지).

```
OBJECT_STORAGE_BUCKET=<개발용 버킷>
OBJECT_STORAGE_ACCESS_KEY=<Access Key>
OBJECT_STORAGE_SECRET_KEY=<Secret Key>
```

키가 없으면 분류 후 보관 단계에서 멈춰요 (행사가 `clustering`에 머묾). 개발용 버킷으로 업로드 → 분류 → 보관 → 조회 → 셀카 매칭까지 확인했어요 (2026-10-26).

- 사진 보기(`<img>`), 대표 얼굴, `downloadUrl` 링크 이동은 바로 동작
- **사진 저장·공유처럼 `downloadUrl`을 JS `fetch`로 받는 기능은 버킷 CORS 설정이 필요**해요. 개발용 버킷은 아직 CORS 설정이 없어서 브라우저에서 막혀요 → 버킷에 프론트 주소(`http://localhost:5173`, 배포 주소) `GET` 허용 필요

### 키 없이 띄우기 (가짜 S3, moto)

NCP 키 대신 메모리 S3 서버(moto)로 대신할 수 있어요. CORS를 기본으로 허용해서 사진 저장·공유도 동작해요.

```bash
uvx --from 'moto[server]' moto_server -H 127.0.0.1 -p 5000     # 터미널 3 (껐다 켜면 사진이 사라짐)
AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local uv run python -c \
  "import boto3; boto3.client('s3', endpoint_url='http://127.0.0.1:5000', region_name='us-east-1').create_bucket(Bucket='photo-sorter-local')"
```

`.env`에는 `OBJECT_STORAGE_ENDPOINT=http://127.0.0.1:5000`, `OBJECT_STORAGE_REGION=us-east-1`, `OBJECT_STORAGE_BUCKET=photo-sorter-local`, 키 두 개는 아무 값(`local`)이나.

Object Storage 없이 API만 볼 거면 `.env`에 `CLUSTERING_SCHEDULER_ENABLED=false`로 스케줄러를 끄면 돼요 (분류·공개가 일어나지 않음).

## 행사 흐름과 프론트가 보는 상태

```
관리자: 행사 생성 → 사진 업로드(반복) → 업로드 완료 → 진행 상황 폴링(API 5)
events.status:  uploading ──(API 4)──▶ extracting ──(워커 끝)──▶ clustering ──(분류·보관 끝)──▶ open
```

- `extracting`: 워커가 사진 처리 중. API 5의 `photos.extracted / processing / failed`가 늘어남
- `clustering`: 남은 사진이 0장이 되면 스케줄러가 자동으로 바꿈 (`failed` 사진은 기다리지 않음)
- `open`: 이때부터 API 7·8·9·10 사용 가능 (그 전에는 `EVENT_NOT_READY`), API 5의 `personCount`가 채워짐
- 사진 100장 기준 워커 1개로 2~3분 정도 (CPU, 사진당 1~2초)

## 응답에서 알아 둘 것

- **이미지 URL**: 모두 Pre-signed URL, `expiresIn`(기본 3600초) 뒤 만료 → 만료되면 같은 API를 다시 불러 새 URL을 받음
- **대표 얼굴(`repFace`)**: 잘린 이미지가 아니라 원본 사진 URL + 얼굴 위치 `bbox`(원본 픽셀 기준). 프론트가 CSS로 잘라 보여줌. 보여줄 수 없으면 `repFace=null`
- **`downloadUrl`(API 9)**: 열면 원래 파일 이름으로 저장되는 주소 (`Content-Disposition: attachment`). JS `fetch`로 받으려면 **버킷 CORS 설정**이 필요 (개발용 버킷은 아직 없음), `<img>`·링크 이동은 불필요
- **사람 폴더 이름**: `label`은 `user1`, `user2` … (사진 많은 순). 한 번만 찍힌 사람도 폴더가 생기니 목록은 `minPhotos=2` 권장
- **토큰**: 관리자·참가자 모두 12시간 만료 → `UNAUTHORIZED`면 다시 로그인·입장
- **에러**: 항상 `{ success: false, error: { code, message } }`. `message`는 화면에 그대로 띄워도 되는 문구, 분기는 `code`로

## 알려진 문제

- 셀카 매칭(API 8) 결과의 `repFace.url`이 항상 `null` (매칭 자체는 정상) → [이슈 #5](https://github.com/najunho04/face-based-photo-sorter/issues/5)

## 실제 얼굴 사진으로 시험하기 (Gallagher 데이터셋)

가족 사진 589장(32명) 공개 데이터셋. 약관상 **재배포 금지**라 각자 받고, 저장소·외부에 올리지 않아요 (`datasets/`는 git 제외).

```bash
uv run python -m extraction.experiments.download_gallagher_dataset          # 약 470MB, 처음엔 몇 분
uv run python -m extraction.experiments.register_gallagher_photos --photo-count 0   # 589장 전부 대기열에 등록 (기본 100장)
uv run python -m extraction.worker --stop-when-queue-empty                  # 약 10분
```

등록하면 인증코드 `GALLAGHER` 행사가 생기고, 워커가 끝나면 API 서버의 스케줄러가 분류·보관 후 `open`으로 바꿔요. 참가자 입장(API 6)에 `GALLAGHER`를 넣으면 돼요.

분류 결과를 눈으로 보려면 `uv run python -m clustering.experiments.build_person_folder_page` → `datasets/gallagher/results/clustering/person_folders.html` (사람별 폴더, 대표 얼굴, 대표 얼굴이 뽑힌 이유).

## 폴더 구조

```
main.py          앱 진입점 (라우터 등록, 분류 스케줄러 시작)
core/            설정, 공통 응답·에러코드, JWT, Object Storage
database/        SQLAlchemy 모델, 세션, migrations(스키마 기준), 얼굴 데이터 계약
authentication/  API 1 관리자 로그인, API 6 참가자 입장
event/           API 2~5 행사 생성, 사진 업로드(NAS 저장), 업로드 완료, 진행 상황
extraction/      워커: 얼굴 검출·벡터 추출 (InsightFace buffalo_l)
clustering/      분류(사람별 묶기, 대표 얼굴), 분류 스케줄러
archive/         NAS → Object Storage 보관, open 전환
gallery/         API 7 전체 사진, API 9 사람 폴더 사진, API 10 사람 폴더 목록
matching/        API 8 셀카 매칭
```
