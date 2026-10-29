# 백엔드

FastAPI + PostgreSQL(pgvector) + InsightFace. API 모양은 [docs/api.md](../docs/api.md), DB·처리 규칙은 [docs/erd.md](../docs/erd.md), 배포는 [docs/deployment.md](../docs/deployment.md)가 기준이에요.

## 주요 기능

### API

| # | API | 대상 | 하는 일 |
|---|---|---|---|
| 1 | `POST /api/admin/login` | 관리자 | 로그인 (토큰 12시간) |
| 2 | `POST /api/admin/events` | 관리자 | 행사 생성, 인증코드 6자리 발급 |
| 3 | `POST /api/admin/events/{eventId}/photos` | 관리자 | 사진 업로드 (여러 장, NAS 저장) |
| 4 | `POST /api/admin/events/{eventId}/upload-complete` | 관리자 | 업로드 완료 → 더 이상 사진을 받지 않음 |
| 5 | `GET /api/admin/events/{eventId}` | 관리자 | 진행 상황 (상태별 사진 수, 사람 수) |
| 6 | `POST /api/events/join` | 참가자 | 인증코드로 입장 |
| 7 | `GET /api/events/{eventId}/photos` | 참가자 | 전체 사진 |
| 8 | `POST /api/events/{eventId}/match` | 참가자 | 셀카로 닮은 사람 폴더 최대 3명 찾기 |
| 9 | `GET /api/events/{eventId}/persons/{personId}/photos` | 참가자 | 사람 폴더 사진 (보기용·저장용 주소) |
| 10 | `GET /api/events/{eventId}/persons` | 참가자 | 사람 폴더 목록 (사진 많은 순, 대표 얼굴) |

### 처리 흐름

```
관리자: 행사 생성 → 사진 업로드(반복) → 업로드 완료 → 진행 상황 확인(API 5)
events.status:  uploading ──(API 4)──▶ extracting ──(남은 사진 0장)──▶ clustering ──(분류·보관 끝)──▶ open
```

API 서버·워커·스케줄러는 서로를 직접 부르지 않고 **DB의 상태 값으로만 주고받아요.**

- **워커**는 행사 상태와 상관없이 `photos.status='uploaded'`인 사진을 가져가요 → 업로드하는 동안 얼굴 찾기가 같이 진행돼 기다리는 시간이 줄어요.
- **업로드 완료(API 4)**는 "사진이 다 모였다"는 신호예요. 이 뒤에 남은 사진이 0장이 되면 분류를 시작해요.
- **분류 스케줄러**(API 서버 안, 5초마다): 멈춘 사진 복구 → 분류 시작 → 분류 → 보관 → `open`
- `open`이 되어야 API 7~10을 쓸 수 있어요 (그 전에는 `EVENT_NOT_READY`).

### 기능별 핵심

**사진 업로드 (API 3)**
- 한 장씩 검사하고, 한 장이 실패해도 나머지는 저장해요 (20MB 제한, jpg·png는 확장자가 아니라 파일 앞부분 바이트로 판단, 경로를 지운 파일 이름만 사용).
- NAS에는 임시 이름으로 끝까지 쓴 뒤 이름을 바꿔요 → 덮어쓰는 중이거나 서버가 죽어도 반쯤 쓰인 사진이 남지 않아요.
- 같은 행사에 같은 파일 이름 = 같은 사진. 다시 올리면 파일만 덮어쓰고 DB 행은 늘리지 않아요 (처리 실패했던 사진만 다시 처리).
- 업로드는 행사 행에 `FOR SHARE`, 업로드 완료는 `FOR UPDATE` 잠금 → 업로드끼리는 동시에 진행되고, 완료 처리 중에 사진이 끼어들지 않아요.

**얼굴 찾기 (워커)**
- InsightFace `buffalo_l`로 얼굴 위치와 특징 값(512차원 벡터)을 뽑아 `faces`에 저장해요.
- 여러 워커가 같은 사진을 잡지 않아요 (`FOR UPDATE SKIP LOCKED`). 5분 넘게 끝나지 않은 사진은 다른 워커가 이어받아요.
- 큰 사진은 줄여서 분석한 뒤 원본 좌표로 되돌리고, 흐리거나 너무 작은 얼굴은 걸러요.

**사람 분류 (스케줄러)**
- 행사의 얼굴 전체를 **평균 연결 계층적 군집**으로 묶어요. 사람 수를 미리 몰라도 되고, 묶음 사이 평균 코사인 거리가 0.65 이하일 때만 합쳐요.
- 묶음마다 `persons` 행: 이름(`user1`…, 사진 많은 순), 대표 벡터(얼굴 벡터 평균), 대표 얼굴(충분히 크고 평균과 가장 닮은 얼굴).
- 사람 폴더는 **DB에만 있어요.** 얼굴마다 `person_id`를 기록하고, 폴더를 열 때 조회로 사진을 모아요 → 단체 사진도 파일은 1개.
- 분류 결과 저장은 트랜잭션 하나라 중간에 서버가 죽어도 반쪽 결과가 남지 않아요. 서버가 여러 대여도 행사별 DB 잠금(advisory lock)으로 한 서버만 처리해요.

**보관·공개**
- 분류가 끝나면 사진을 **1장씩** NAS → Object Storage로 올리고, 한 장마다 기록해요 → 멈춰도 남은 사진만 이어서 올려요.
- 다 올리면 `open`. 사진은 1시간짜리 서명 URL(Pre-signed URL)로만 제공해요.

**셀카 매칭 (API 8)**
- 셀카에서 가장 큰 얼굴의 벡터를 사람별 대표 벡터와 pgvector로 비교해, 유사도 0.40 이상인 상위 3명을 돌려줘요.
- 셀카는 저장하지 않아요.

### 실험·검증 결과

| 항목 | 결과 |
|---|---|
| 분류 기준값 (공개 데이터셋 Gallagher 589장·32명) | 거리 0.65에서 F1 0.992 (0.75부터 다른 사람이 섞임) |
| 셀카 매칭 (같은 데이터셋) | 기준값 0.40에서 1순위 정답률 100% |
| 처리 속도 | 사진 100장, 워커 1개로 약 2~3분 (CPU, 사진당 1~2초) |
| 테스트 | `uv run pytest` 233개 |

기준값은 가족 사진 데이터셋으로 정한 값이라, 실제 행사 사진(사람 수, 단체 사진)으로 다시 확인할 필요가 있어요. 운영 환경 검증 결과는 [docs/deployment.md](../docs/deployment.md) 8절에 있어요.

## 실행되는 것 3개

같은 코드에서 시작 명령만 다른 프로그램 2개 + DB.

| 프로그램 | 실행 (backend/에서) | 하는 일 |
|---|---|---|
| DB | `docker compose up -d` | PostgreSQL 16 + pgvector. 첫 실행 때 스키마 자동 생성 |
| API 서버 | `uv run uvicorn main:application --reload` | API 1~10 + 분류 스케줄러 |
| 워커 | `uv run python -m extraction.worker` | 얼굴 검출·벡터 추출. 여러 개 띄워도 됨 |

워커를 안 띄우면 행사가 `extracting`에서 멈춰요. API 서버도 셀카 매칭 때문에 얼굴 분석 모델을 써요 (첫 요청 때 몇 초 로드, 모델 파일은 첫 실행 때 자동 다운로드).

배포에서는 같은 Dockerfile의 target `api`·`worker`로 이미지를 따로 만들어 각각 띄워요 (늘리는 기준이 다름: 워커는 사진 양, API는 접속자 수).

## 로컬에서 처음 띄우기

```bash
cd backend
uv sync                  # Python 3.12 + 의존성 (uv.lock 기준)
cp .env.example .env     # 로컬 값 그대로 써도 됨. Object Storage는 아래 참고
docker compose up -d
uv run uvicorn main:application --reload       # 터미널 1: http://localhost:8000/docs 에서 API 시험
uv run python -m extraction.worker             # 터미널 2
uv run pytest                                  # 테스트 (DB 필요)
```

이미 DB 볼륨이 있으면 새 마이그레이션은 자동 적용되지 않아요 (`docker-entrypoint-initdb.d`는 빈 볼륨일 때만 실행). 아래처럼 한 번 적용하거나, 데이터를 버려도 되면 `docker compose down -v && docker compose up -d`.

```bash
docker compose exec -T database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/migrations/002_unique_photo_file_name.sql
```

프론트는 `frontend/.env.development.local`에 `VITE_USE_MOCK=false`를 두면 Vite 개발 서버가 `/api`를 `localhost:8000`으로 넘겨줘요 (로컬에서는 백엔드 CORS 불필요).

### Object Storage (NCP)

사진 URL은 전부 Object Storage Pre-signed URL이에요. NCP 버킷 이름과 키를 `.env`에 넣어요 (키는 커밋하지 않음).

```
OBJECT_STORAGE_BUCKET=<버킷>
OBJECT_STORAGE_ACCESS_KEY=<Access Key>
OBJECT_STORAGE_SECRET_KEY=<Secret Key>
```

키가 없으면 분류 후 보관 단계에서 멈춰요 (행사가 `clustering`에 머묾). 사진 저장·공유는 브라우저가 JS로 사진을 받기 때문에 버킷 CORS에 화면 주소(`http://localhost:5173` 등) GET·HEAD 허용이 필요해요.

### 키 없이 띄우기 (가짜 S3, moto)

NCP 키 대신 메모리 S3 서버(moto)를 쓸 수 있어요. CORS를 기본으로 허용해서 사진 저장·공유도 동작해요.

```bash
uvx --from 'moto[server]' moto_server -H 127.0.0.1 -p 5000     # 터미널 3 (껐다 켜면 사진이 사라짐)
AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local uv run python -c \
  "import boto3; boto3.client('s3', endpoint_url='http://127.0.0.1:5000', region_name='us-east-1').create_bucket(Bucket='photo-sorter-local')"
```

`.env`에는 `OBJECT_STORAGE_ENDPOINT=http://127.0.0.1:5000`, `OBJECT_STORAGE_REGION=us-east-1`, `OBJECT_STORAGE_BUCKET=photo-sorter-local`, 키 두 개는 아무 값(`local`)이나.

Object Storage 없이 API만 볼 거면 `.env`에 `CLUSTERING_SCHEDULER_ENABLED=false`로 스케줄러를 끄면 돼요 (분류·공개가 일어나지 않음).

## 응답에서 알아 둘 것

- **이미지 URL**: 모두 Pre-signed URL, `expiresIn`(기본 3600초) 뒤 만료 → 같은 API를 다시 불러 새 URL을 받음
- **대표 얼굴(`repFace`)**: 잘린 이미지가 아니라 원본 사진 URL + 얼굴 위치 `bbox`(원본 픽셀 기준). 프론트가 잘라 보여 줌. 보여 줄 수 없으면 `repFace=null`
- **`downloadUrl`(API 9)**: 열면 원래 파일 이름으로 저장되는 주소 (`Content-Disposition: attachment`). JS `fetch`로 받으려면 버킷 CORS 필요
- **사람 폴더 이름**: `label`은 `user1`, `user2` … (사진 많은 순). 한 번만 찍힌 사람도 폴더가 생기니 목록은 `minPhotos=2` 권장
- **토큰**: 관리자·참가자 모두 12시간 만료 → `UNAUTHORIZED`면 다시 로그인·입장
- **에러**: 항상 `{ success: false, error: { code, message } }`. `message`는 화면에 그대로 띄워도 되는 문구, 분기는 `code`로

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
Dockerfile       배포 이미지 (target api·worker)
```
