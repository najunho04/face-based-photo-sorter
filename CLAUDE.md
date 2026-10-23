# face-based-photo-sorter

행사 사진(관리자가 ~100장 업로드)을 얼굴별로 자동 분류하고, 참가자가 셀카로 본인 폴더를 찾아 내려받는 서비스.
- **관리자**: id/pw 로그인 → 행사 생성(인증코드·QR 발급) → 사진 업로드
- **참가자**: 인증코드로 입장 → 셀카 매칭(후보 최대 3명) 또는 폴더 직접 선택 → 사진 보기·다운로드

## 팀 (네이버클라우드 1팀)
- 백엔드 2명 — 작업 영역이 겹치지 않게 나누고, 공유 코드(스키마·응답 형식·에러코드) 변경은 상대에게 알릴 것
- 프론트 1명 (React) / 인프라 1명

## 스택
- Python 백엔드, Ubuntu 서버, PostgreSQL + pgvector (VECTOR(512), 코사인 유사도)
- NCP: ALB → API 서버(ASG) / 워커 서버(ASG), NAS(NFS) 원본 임시 저장, Object Storage 보관·Pre-signed URL
- 별도 큐 없음: `photos.status`가 작업 큐 역할

## 처리 흐름
1. 업로드: 웹서버가 `/nas/event{id}/`에 저장 + `photos` INSERT(`uploaded`)
2. 추출(워커, 병렬): `uploaded` 1장을 `processing`으로 잡음 → 얼굴 검출·임베딩 → `faces` INSERT + `extracted` (한 트랜잭션)
3. 분류(웹서버): 행사의 `uploaded`·`processing`이 0장이면 `faces` 클러스터링 → `persons`(centroid, 대표 얼굴) 생성
4. 보관: 원본을 Object Storage에 올리고 `photos.object_key` 채움 → `events.status=open`
5. 매칭: 셀카는 웹서버가 동기 처리 → `persons.centroid`와 비교, 기준값 이상 상위 3명

- 사진 폴더는 실제 복사하지 않고 `faces.person_id`로 표현 (단체 사진은 여러 사람 폴더에 동시 등장)
- 대표 얼굴: 중심 벡터와 가까움 + 검출 점수 높음 + 얼굴 크기 큼. 응답은 원본 URL + bbox

## 디렉토리 (backend/, 도메인별 — 담당 A: 처리 1·3·4, B: 처리 2·매칭)
```
database/migrations/  공용  스키마 SQL, DB 연결·모델
nas/                  공용  로컬 NAS 대체 경로 (이미지 커밋 금지)
core/                 공용  설정·JWT·공통 응답·에러코드·Object Storage
authentication/       A     API 1·6 (관리자 로그인, 참가자 입장)
event/                A     처리 1, API 2~5
clustering/           A     처리 3
archive/              A     처리 4
gallery/              A     API 7·9·10
extraction/           B     처리 2 (워커 루프, 얼굴 분석)
matching/             B     API 8 (extraction의 얼굴 분석 함수 사용)
tests/                각자  도메인별 테스트
```
- A·B는 코드 호출 대신 `photos`·`faces` 테이블로 주고받음. 상대 영역 폴더는 수정하지 말고 요청할 것

## 상세 문서 (작업 전 해당 문서를 먼저 읽을 것)
- DB 스키마·상태값·인덱스·워커 큐/실패 처리 → [docs/erd.md](docs/erd.md)
- 엔드포인트·요청/응답·에러코드·호출 흐름 → [docs/api.md](docs/api.md)
- 원본(Notion): [기획](https://app.notion.com/p/3fb0ea4df785802aa91cd4513c38c1b6) · [백엔드 흐름](https://app.notion.com/p/3fb0ea4df78580f68c86d8936c86967c) · [API 명세](https://app.notion.com/p/API-4020ea4df7858001a2a6f14efcfd123d) · [아키텍처](https://app.notion.com/p/3fb0ea4df7858099a6a8e92ea796e8c9)

## 규칙
- 요청이 추상적이거나 해석이 여러 갈래면 추측해서 구현하지 말고 먼저 되물을 것
- TDD로 개발: 실패하는 테스트(`tests/`) 먼저 작성 → 통과하는 최소 구현 → 리팩터링
- 모든 변수·함수·파라미터 이름은 축약 없이 풀네임으로 작성 (`img` ✗ → `image`, `emb` ✗ → `embedding`, `cnt` ✗ → `count`)
- 코드마다 무엇을·왜 하는지 구체적인 주석을 1~2줄 작성
- 모든 응답은 `{ success, data, error }` 형식, 실패 시 `error.code`는 docs/api.md 에러코드 표에 있는 값만 사용 (새 코드는 문서부터 추가)
- API 필드는 camelCase, DB 컬럼은 snake_case
- 이미지는 서버가 직접 서빙하지 않고 Pre-signed URL(600초)로만 전달
- 참가자 JWT의 `eventId`와 경로 `eventId`가 다르면 `FORBIDDEN`
- 유사도 점수는 API 응답에 노출하지 않음
- API·스키마를 바꾸면 docs/와 Notion을 같이 갱신

## 필수 범위 밖 (요청 없으면 구현하지 말 것)
- 폴더 합치기·나누기(검수), ZIP 다운로드, 관리자 행사 목록
