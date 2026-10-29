# 배포 가이드 (인프라 전달용)

> 2026-10-27 작성. 인프라 아키텍처 그림(VPC, Load Balancer, API 서버·워커 서버 Auto scaling, Cloud DB, NAS, Object Storage) 기준.
> 백엔드 실행 구성은 [backend/README.md](../backend/README.md), API는 [api.md](api.md), DB는 [erd.md](erd.md)가 기준이에요.

배포 단위는 3개예요.

| 단위 | 형태 | 올리는 곳 |
|---|---|---|
| 프론트 | 정적 파일 (`frontend/dist/`) | Object Storage 화면 버킷 (+ Global Edge) |
| API 서버 | Docker 이미지 `photo-sorter-api` | Container Registry → API 서버 Auto scaling |
| 워커 | Docker 이미지 `photo-sorter-worker` | Container Registry → 워커 서버 Auto scaling |

API 서버와 워커는 서로 호출하지 않고 **DB(`photos.status`)와 NAS로만** 주고받아요. 둘 다 같은 DB, 같은 NAS를 봐야 해요.

---

## 1. 먼저 확인 부탁드려요 (아키텍처 그림과 다른 점)

| # | 그림 | 실제로 필요한 것 | 왜 |
|---|---|---|---|
| 1 | Cloud DB **TCP 3306**(MySQL) | **Cloud DB for PostgreSQL, 5432** + **pgvector 확장** | 셀카 매칭 벡터 검색(`<=>`), 워커 작업 잡기(`FOR UPDATE SKIP LOCKED`), 분류 잠금(advisory lock)이 모두 PostgreSQL 기능. **pgvector(`CREATE EXTENSION vector`)를 쓸 수 있는지 가장 먼저 확인** — 안 되면 DB 구성이 바뀌어야 해요 |
| 2 | NAS(NFS)가 **워커 서버에만** 연결 | **API 서버도 같은 NAS를 같은 경로로** 마운트 | 사진 업로드(API 3)는 API 서버가 NAS에 저장, 보관(NAS → Object Storage)도 API 서버 안의 스케줄러가 NAS에서 읽음 |
| 3 | NAT·Object Storage 연결이 **워커 쪽에만** | **API 서버도 Object Storage에 접근** (NAT 또는 내부 경로) | 보관 단계에서 API 서버가 사진을 Object Storage에 올림. (얼굴 모델은 이미지에 넣어서 모델 다운로드용 외부 연결은 필요 없어요) |
| 4 | 사용자 ↔ Load Balancer **HTTP 80** | 아래 2절 참고 | HTTP면 일부 휴대폰 기능이 꺼짐 |

같이 확인해 주세요.

- **요청 크기·대기 시간**(Load Balancer 또는 Global Edge): 요청 크기 **10MB 이상**(업로드는 보통 한 번에 3MB 안팎, 사진 1장 최대 20MB), 대기 시간 **60초 이상**(업로드·셀카 매칭).
- **Load Balancer 상태 확인**: `GET /health` → 200 (DB는 보지 않아요. DB가 잠깐 끊겨도 서버가 한꺼번에 빠지지 않게).
- **DB 스키마 적용**: 4절.
- **사진 버킷 CORS**: 5절.

---

## 2. 접속 구성 (HTTP 기준 추천)

```
사용자 ──HTTP──▶ Global Edge (<이름>.edge.naverncp.com, 주소 1개)
                   ├─ /api/*  → Load Balancer → API 서버   (룰 기반 원본 라우팅)
                   └─ 나머지   → 화면 버킷 (URL Rewrite: /e/*, /admin/*, /expired → /index.html)
```

- 화면과 API 주소가 같아서 **백엔드 CORS가 필요 없고**, 프론트 빌드 때 `VITE_API_BASE_URL`을 비워 두면 돼요.
- **URL Rewrite는 꼭 필요해요.** 없으면 QR(`/e/코드`)로 바로 들어오거나 새로고침할 때 404가 나요. Object Storage만으로는 해결되지 않아요.
- Global Edge를 거치는 업로드(POST)의 크기·시간 제한이 위 값보다 작으면, 화면은 Global Edge·API는 Load Balancer 주소로 따로 두는 구성(주소 2개)으로 가요. 이때는 백엔드 CORS 설정이 필요하니 백엔드에 화면 주소를 알려 주세요.

**HTTP로 두면 꺼지는 기능** (브라우저가 HTTPS에서만 허용)

| 기능 | HTTP에서 | 대신 |
|---|---|---|
| 셀카 화면 안 카메라 | 안 됨 | 갤러리에서 고르기(휴대폰에서 "사진 찍기" 선택 가능) → 매칭은 됨 |
| 아이폰 사진 앱에 바로 저장(공유 시트) | 안 됨 | 다운로드("파일" 앱에 저장) |
| 관리자 입장 링크 복사 | 안 됨 | "길게 눌러 복사" 안내, QR 저장은 됨 |

관리자 비밀번호·토큰도 암호화 없이 오가요. 데모가 끝나면 관리자 비밀번호를 바꾸고 행사 데이터를 지우는 걸 권해요.

**HTTPS로 올릴 때** (코드 변경 없음): 도메인 → Global DNS 등록 → Certificate Manager에서 **Global Edge 전용 인증서**(무료, Let's Encrypt, 90일, DNS CNAME 검증) → Global Edge에 연결. Global Edge 자동 도메인에서 인증서 없이 HTTPS가 되는지도 콘솔에서 한번 확인해 주세요.

---

## 3. API 서버·워커 이미지

### 3-1. 빌드 (`backend/`에서)

같은 Dockerfile에서 target만 달라요. 얼굴 분석 모델(InsightFace buffalo_l 중 검출·벡터 2개)이 **이미지 안에 들어 있어서** 서버가 뜰 때 인터넷에서 받지 않아요.

```bash
cd backend
docker build --target api    -t photo-sorter-api:<버전> .
docker build --target worker -t photo-sorter-worker:<버전> .
```

- 이미지 크기 약 2GB (onnxruntime·OpenCV·모델 포함). 빌드할 때는 인터넷 필요(파이썬 패키지, 모델 288MB).
- 서버가 x86_64(amd64)가 아니면 `--platform` 지정이 필요해요.

### 3-2. Container Registry에 올리기

NCP Container Registry = AWS ECR 같은 역할이에요. 레지스트리를 만들면 상세 화면에 엔드포인트가 나와요.

- 공개 엔드포인트: `<레지스트리 이름>.kr.ncr.ntruss.com` (밖에서 push할 때)
- 프라이빗 엔드포인트: `<무작위>.kr.private-ncr.ntruss.com` (VPC 안 서버에서 pull할 때)
- 로그인: 아이디 = API 인증키 **Access Key ID**, 비밀번호 = **Secret Key**

```bash
REGISTRY=<레지스트리 이름>.kr.ncr.ntruss.com
docker login $REGISTRY                                   # Access Key ID / Secret Key
docker tag photo-sorter-api:<버전>    $REGISTRY/photo-sorter-api:<버전>
docker tag photo-sorter-worker:<버전> $REGISTRY/photo-sorter-worker:<버전>
docker push $REGISTRY/photo-sorter-api:<버전>
docker push $REGISTRY/photo-sorter-worker:<버전>
```

### 3-3. 서버에서 실행

공통 준비 (Auto scaling 서버 이미지 또는 시작 스크립트에 넣어 주세요)

1. Docker 설치, Container Registry 로그인(프라이빗 엔드포인트)
2. NAS를 NFS로 마운트: 예) `/mnt/nas` — **API 서버와 워커 모두 같은 NAS**
3. NAS 폴더 권한: 컨테이너는 uid **10001** 계정으로 실행돼요. NAS 폴더를 이 uid가 쓸 수 있게 하거나, `docker run --user <NAS 소유 uid>:<gid>`로 맞춰 주세요.
4. 설정 파일 `/etc/photo-sorter/env` (아래 3-4)

```bash
# API 서버 (Load Balancer 대상 포트 8000)
docker run -d --name photo-sorter-api --restart unless-stopped \
  --env-file /etc/photo-sorter/env \
  -v /mnt/nas:/nas \
  -p 8000:8000 \
  $REGISTRY/photo-sorter-api:<버전>

# 워커 (포트 없음, 서버당 1개. 더 필요하면 서버를 늘림)
docker run -d --name photo-sorter-worker --restart unless-stopped \
  --env-file /etc/photo-sorter/env \
  -v /mnt/nas:/nas \
  $REGISTRY/photo-sorter-worker:<버전>
```

- 워커는 `docker stop`(SIGTERM)을 받으면 **지금 사진만 끝내고** 멈춰요(1~2초). 중간에 죽어도 5분 뒤 API 서버가 그 사진을 대기열로 되돌려요.
- API 서버를 여러 대 띄워도 분류·보관은 행사마다 한 서버만 해요(DB 잠금).
- 로그는 `docker logs <이름>`. Cloud Insight로 모을 때도 컨테이너 표준 출력이에요.
- 서버 크기: 얼굴 분석이 CPU를 써요(로컬 기준 사진 1장 약 1초). 워커 컨테이너는 모델을 올린 직후 메모리 약 600MB(로컬 측정), 사진을 처리할 때 사진 크기만큼 더 써요. API 서버도 셀카 매칭 때문에 첫 매칭 요청 때 같은 모델을 올려요.

### 3-4. 설정 파일 (`/etc/photo-sorter/env`)

이미지에는 비밀값이 없어요. API 서버·워커가 같은 파일을 써도 돼요. **채팅·저장소에 올리지 마세요.**

| 키 | 운영 값 | 설명 |
|---|---|---|
| `POSTGRES_HOST` | Cloud DB 사설 도메인 | |
| `POSTGRES_PORT` | `5432` | |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Cloud DB 값 | |
| `NAS_ROOT_PATH` | **`/nas`** | 컨테이너 안 경로. 로컬 `.env`의 `./nas`를 그대로 쓰면 업로드가 권한 오류로 실패해요 |
| `JWT_SECRET_KEY` | **32바이트 이상 무작위** | 예: `openssl rand -hex 32`. 서버끼리 같아야 해요 |
| `ADMIN_LOGIN_ID` / `ADMIN_PASSWORD` | 관리자 계정 | 데모용 1개 |
| `ACCESS_TOKEN_EXPIRATION_SECONDS` | `43200` (기본) | 12시간 |
| `OBJECT_STORAGE_ENDPOINT` | `https://kr.object.ncloudstorage.com` | |
| `OBJECT_STORAGE_REGION` | `kr-standard` | |
| `OBJECT_STORAGE_BUCKET` | 사진 버킷 (비공개) | 화면 버킷과 따로 |
| `OBJECT_STORAGE_ACCESS_KEY` / `OBJECT_STORAGE_SECRET_KEY` | API 인증키 | 사진 버킷 읽기·쓰기 |
| `PRESIGNED_URL_EXPIRATION_SECONDS` | `3600` (기본) | 사진 URL 만료 |
| `CLUSTERING_SCHEDULER_ENABLED` | `true` (기본) | API 서버의 분류 스케줄러. 워커에는 영향 없음 |

---

## 4. DB 준비 (Cloud DB for PostgreSQL)

처음 한 번, Bastion에서 `backend/database/migrations/`의 SQL을 **파일 이름 순서대로** 실행해요.

```bash
psql -h <Cloud DB 주소> -U <사용자> -d <DB> -f 001_initial_schema.sql   # 테이블 4개 + pgvector 확장
psql -h <Cloud DB 주소> -U <사용자> -d <DB> -f 002_unique_photo_file_name.sql
```

- `001`의 첫 줄이 `CREATE EXTENSION IF NOT EXISTS vector;`예요. 여기서 실패하면 1절 1번(pgvector 지원) 문제예요.
- 새 마이그레이션 파일이 생기면 그 파일만 추가로 실행해요.

---

## 5. Object Storage 버킷

| 버킷 | 공개 | 용도 |
|---|---|---|
| 사진 버킷 | **비공개** | 원본 사진 보관. 사용자는 Pre-signed URL(1시간)로만 봄 |
| 화면 버킷 | 공개 | 프론트 정적 파일 |

**사진 버킷 CORS** — 브라우저 보안 규칙 때문에, 화면 주소에서 JS로 사진 파일을 받으려면 버킷이 "이 화면 주소는 허용"이라고 답해야 해요. `<img>`로 보여 주는 건 CORS 없이도 되지만, **사진 저장·공유 기능은 사진을 JS로 받아서 CORS가 필요**해요.

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["http://<화면 주소>"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

```bash
# S3 호환 API로 설정 (NCP 콘솔에 메뉴가 없으면). 개발 버킷이면 http://localhost:5173 도 추가
aws --endpoint-url=https://kr.object.ncloudstorage.com s3api put-bucket-cors \
  --bucket <사진 버킷> --cors-configuration file://cors.json
```

(NCP Object Storage의 CORS 설정 방법은 콘솔·가이드에서 한번 확인해 주세요.)

---

## 6. 프론트 (빌드 → 화면 버킷 업로드)

준비: Node.js 22 이상. `frontend/`에서.

1. `frontend/.env.production.local` (저장소에 안 올라감)
   - 2절 구성(주소 1개): `VITE_API_BASE_URL=` 비워 둠 → 같은 주소의 `/api`로 요청
   - 주소 2개 구성: `VITE_API_BASE_URL=http://<API 주소>` (뒤에 `/api` 붙이지 않음)
2. 빌드: `npm ci && npm run build` → `frontend/dist/` (약 4MB). API 주소는 빌드할 때 파일에 들어가서, 바뀌면 다시 빌드해야 해요.
3. 화면 버킷에 올리기 (assets 먼저, `index.html` 마지막)

```bash
ENDPOINT=https://kr.object.ncloudstorage.com
BUCKET=<화면 버킷>
aws --endpoint-url=$ENDPOINT s3 sync frontend/dist/assets s3://$BUCKET/assets \
  --acl public-read --cache-control "public, max-age=31536000, immutable"
aws --endpoint-url=$ENDPOINT s3 cp frontend/dist/favicon.svg s3://$BUCKET/favicon.svg \
  --acl public-read --cache-control "public, max-age=86400"
aws --endpoint-url=$ENDPOINT s3 cp frontend/dist/index.html s3://$BUCKET/index.html \
  --acl public-read --cache-control "no-cache" --content-type "text/html; charset=utf-8"
```

4. Global Edge URL Rewrite (2절): `/`, `/e/*`, `/admin/*`, `/expired` → `/index.html`
5. 다시 배포할 때: 빌드 → 3번 → Global Edge에서 `/index.html` Purge

---

## 7. 배포 순서 체크리스트

- [ ] 1절 확인 (특히 pgvector)
- [ ] Cloud DB for PostgreSQL 생성 → 4절 SQL 적용
- [ ] NAS 생성 → API·워커 서버 모두 마운트, uid 10001 권한
- [ ] 사진 버킷(비공개, CORS) / 화면 버킷(공개)
- [ ] Container Registry 생성 → 3-1·3-2 이미지 push
- [ ] API 서버·워커 서버 Auto scaling: 시작 스크립트(Docker, 레지스트리 로그인, NAS 마운트, env 파일, `docker run`)
- [ ] Load Balancer → API 서버 8000, 상태 확인 `/health`, 요청 크기·대기 시간
- [ ] Global Edge: 화면 버킷 + `/api/*` → Load Balancer, URL Rewrite
- [ ] 프론트 빌드·업로드 (6절)
- [ ] 확인: 관리자 로그인 → 행사 생성 → 사진 업로드 → 업로드 완료 → `open` → 참가자 입장 → 사람 폴더·셀카 매칭

로컬에서 같은 이미지로 이 흐름 전체를 확인했어요 (2026-10-27, Gallagher 8장: 업로드 → 추출 → 분류 6명 → 보관 → 입장·조회·셀카 매칭).
