# face-based-photo-sorter

행사 사진을 얼굴별로 자동 분류하고, 참가자가 셀카로 본인 사진 폴더를 찾아 내려받는 서비스.

## 백엔드 시작하기

```bash
cd backend
uv sync && cp .env.example .env
docker compose up -d                          # DB
uv run uvicorn main:application --reload      # API 서버 + 분류 스케줄러 (http://localhost:8000/docs)
uv run python -m extraction.worker            # 워커 (얼굴 추출)
```

실행되는 프로그램 구성, Object Storage 키 없이 띄우는 법, 프론트가 알아 둘 응답 규칙은 [backend/README.md](backend/README.md)에 있어요.

## 백엔드 팀원에게

초기 세팅 올려뒀어요. 위 명령으로 바로 띄울 수 있어요.

- **담당**: `backend/extraction/`(처리 2: 워커 루프, 얼굴 검출·임베딩)과 `backend/matching/`(API 8: 셀카 매칭)을 맡아 주세요. 나머지 도메인(업로드·분류·보관·조회)은 제가 해요.
- **얼굴 분석 라이브러리**: InsightFace `buffalo_l` (`pyproject.toml`).
- **스키마**: ERD 그대로 `backend/database/migrations/001_initial_schema.sql`에 넣었어요. 바꿀 게 있으면 `docs/erd.md`부터 같이 정해요.
- **주고받는 방식**: 서로 코드를 호출하지 않고 DB로만 주고받아요.
  - 제가 `photos`에 `status='uploaded'`, `nas_path`를 넣으면 → 워커가 잡아서 `faces` INSERT + `extracted`/`failed`
  - 큐 규칙(작업 잡기, 실패·복구)은 `docs/erd.md`의 "워커 큐 규칙" 참고
- **DB 접근**: SQLAlchemy ORM으로 통일 (`backend/database/`에 모델 공용으로 둠). 스키마 자체는 migrations SQL이 기준이에요.
- **규칙**
  - 변수·함수 이름은 축약 없이 풀네임 (`img` → `image`, `emb` → `embedding`)
  - 코드마다 무엇을·왜 하는지 주석 1~2줄
  - TDD: 실패하는 테스트 먼저 → 최소 구현 → 리팩터링
  - 도메인당 브랜치 `feature/<도메인 폴더명>` (예: `feature/extraction`), main 직접 커밋 금지
  - 상대 담당 폴더는 수정하지 말고 요청하기
- **CLAUDE.md**: 저장소에는 올리지 않고 각자 로컬에서 관리해요 (`.gitignore`).

## 문서

- [backend/README.md](backend/README.md) — 백엔드 실행 구성·프론트 연동 메모
- [docs/api.md](docs/api.md) — API 명세·에러코드
- [docs/erd.md](docs/erd.md) — DB 스키마·워커 큐 규칙·분류 규칙
