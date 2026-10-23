# 인생내컷 프론트엔드 개발 계획

> 이 문서는 프론트엔드 개발의 기준입니다. 각 단계를 시작하기 전에 이 문서를 다시 읽고,
> **고려할 점 · 문제가 생길 수 있는 부분 · 물어볼 것**을 먼저 정리한 뒤 진행합니다.
> 단계가 끝나면 체크리스트와 "결정 기록"을 업데이트합니다.

- 소스 코드 위치: `frontend/` (팀 저장소 `najunho04/face-based-photo-sorter`의 `frontend` 브랜치)
- 이 문서 위치: `frontend/docs/frontend-dev-plan.md`
- 작성일: 2026-10-23

---

## 1. 참고 자료

| 자료 | 위치 |
|---|---|
| 디자인 명세서 | `frontend/docs/design-system/insaengnaecut/MASTER.md` |
| 디자인 토큰 | `frontend/docs/design-system/insaengnaecut/tokens.css` |
| 화면 시안 (35장) | https://claude.ai/artifact/W4Q5p2VuNAvjgpFbd2sWt5 |
| **팀 규칙** | 저장소 루트 `CLAUDE.md` (작업 전 반드시 읽기) |
| **API 명세 (저장소 기준)** | 저장소 루트 `docs/api.md` — Notion 원본보다 이 문서를 우선 |
| DB 스키마 | 저장소 루트 `docs/erd.md` |
| API 명세 (Notion 원본) | https://app.notion.com/p/API-4020ea4df7858001a2a6f14efcfd123d |
| 백엔드 흐름 | https://app.notion.com/p/3fb0ea4df78580f68c86d8936c86967c |
| PRD | https://claude.ai/code/artifact/3baf906f-2ac6-4cfb-9267-101d146e0ec9 |

## 2. 진행 방식

각 단계는 아래 순서로 진행합니다.

1. **읽기:** 이 문서에서 해당 단계를 다시 읽는다.
2. **검토:** 고려할 점, 문제가 생길 수 있는 부분, 물어볼 것을 정리해서 먼저 공유한다.
3. **확인:** 물어볼 것이 있으면 답을 받은 뒤에 진행한다. 임의로 정하지 않는다.
4. **구현:** 체크리스트대로 작업한다.
5. **확인:** "끝났을 때 확인할 것"을 직접 확인한다.
6. **기록:** 체크리스트를 체크하고, 정한 내용은 "결정 기록"에 남긴다.

**git 규칙**
- 프론트 작업은 저장소의 `frontend/` 폴더 안에서만 한다. 백엔드(`backend/`)·공용 문서(`docs/`)는 수정하지 않고 요청한다.
- `main`은 건드리지 않고 `frontend` 브랜치에서 작업한 뒤 나중에 머지한다. `frontend` 브랜치는 `main` 위에 쌓여 있다.
- 단계마다, 또는 작은 작업이 끝날 때마다 커밋한다. push는 어느 정도 작업이 쌓이면(단계 완료 등) 따로 묻지 않고 한다. 강제 push는 하지 않는다.
- 저장소 루트 `.gitignore`: 환경 변수 파일은 `.env.example`만 커밋, `.vscode/` 제외.

**코드 규칙 (`CLAUDE.md`를 프론트에 적용한 것)**
- 변수·함수·파라미터 이름은 축약 없이 풀네임 (`img` ✗ → `image`, `idx` ✗ → `index`, `e` ✗ → `event`). 단, shadcn 원본 코드와 관례적인 `cn()`은 예외.
- 코드마다 무엇을·왜 하는지 주석 1~2줄.
- TDD는 로직에만: 업로드 대기열, 이미지 리사이즈, API 클라이언트·오류 변환, 폴더 합치기 등은 실패하는 테스트를 먼저 쓴다. 화면 컴포넌트는 직접 확인.
- 요청이 애매하면 추측해서 구현하지 말고 먼저 묻는다.

## 3. 기술 스택과 확정된 결정

| 항목 | 결정 |
|---|---|
| 기본 | React + TypeScript + Vite (SPA, 서버 렌더링 없음) |
| 패키지 매니저 | npm |
| 스타일 | Tailwind CSS v4 + `tokens.css` |
| 컴포넌트 | shadcn/ui 기반 + 서비스 전용 컴포넌트 |
| 아이콘 | Lucide (`lucide-react`) |
| 글꼴 | Pretendard (가변) |
| 라우팅 | React Router |
| 서버 데이터 | TanStack Query |
| 전역 상태 | Zustand (토큰, 동의 여부, 내 폴더 정도만) |
| 폼 | react-hook-form + zod (관리자) |
| 사진 넘기기 | Embla Carousel (shadcn Carousel) |
| QR | `qrcode` |
| 가짜 API | MSW |
| 테스트 | Vitest (로직만) + 실제 기기 수동 확인 |
| 화면 모드 | 라이트 모드만 |

**API·서비스 관련 결정 (백엔드 명세 기준)**
- 인증: 관리자·참가자 모두 `Authorization: Bearer <JWT>`. 토큰은 sessionStorage.
- 공통 응답: `{ success, data, error: { code, message } }`. 화면 문구는 `error.code`로 프론트가 정함.
- 사진 업로드: 브라우저에서 **긴 변 2000px로 줄여 JPG로**, **요청당 1장**, 동시 4장, 실패 시 3번 재시도.
- 썸네일 없음: 원본(줄인 사진) URL을 그대로 쓰고 `loading="lazy"`로 보이는 것만 불러옴.
- 대표 얼굴: 원본 URL + `bbox`를 CSS로 잘라서 표시(`FaceCrop`).
- 참가자는 모든 사람 폴더를 볼 수 있음(발표용 결정). 사람별 사진은 `minPhotos=2` 고정.
- 후보는 여러 명 선택 가능 → 고른 폴더들의 사진(#9)을 프론트에서 합쳐서 보여줌.
- 관리자 행사 목록 API 없음 → 만든 행사 번호를 localStorage에 저장해 "최근 행사"로 표시.
- 폴더 이름: 백엔드 `label`(`user3`)의 숫자로 "사람 3" 표시.
- 셀카에 얼굴이 여러 개면 가장 큰 얼굴로 검색(백엔드 처리, 프론트는 "한 명만" 안내).
- 첫 화면은 참가자 입장, 관리자 페이지는 링크로 들어감.

## 4. 폴더 구조

```
frontend/src/
  app/          라우터, Provider, 레이아웃, 가드, 오류 경계
  pages/
    participant/  QrJoin, Entry, Preparing, Home, AllPhotos, Camera, Searching,
                  Candidates, NoMatch, MyPhotos, Viewer, SessionExpired
    admin/        Login, Events, EventCreate, Upload, Processing, Review, Folder
    dev/          UiGallery (/dev/ui, 개발 서버 전용)
  features/
    camera/          useCamera, CameraView, ShutterButton, 권한·인앱 안내
    selfie-search/   검색 요청, 후보 선택
    photo-selection/ 선택 모드, 저장·공유, 진행 표시
    upload/          UploadQueue(순수 TS), useUploadQueue, Dropzone, 리사이즈
    publish/         인증코드·QR 창
  entities/
    session/ event/ photo/ person/   타입, 쿼리 키, API 함수, 작은 표시 컴포넌트(EventStatusBadge 등)
  shared/
    ui/      shadcn 컴포넌트 + AppLogo, FaceCrop, EmptyState, ErrorState, PhotoPlaceholder
    api/     client.ts, api-error.ts, error-messages.ts, token-storage.ts, query-client.ts
    lib/     stored-value.ts (+ 이후 image.ts, download.ts, share.ts)
    styles/  tokens.css, index.css
  mocks/   MSW 핸들러, 샘플 데이터, 일러스트 사진, 오류 재현 패널
```

규칙: **위에서 아래로만 import** (app → pages → features → entities → shared). features끼리는 서로 import하지 않음.
`mocks/`는 옆에 붙은 개발 도구라 entities·shared를 쓸 수 있지만, `mocks/`를 import하는 곳은 `main.tsx`와 테스트뿐이다.

## 5. 라우트

| 주소 | 화면 (시안 번호) | 가드 |
|---|---|---|
| `/` | ① 입장 | 없음 |
| `/e/:code` | ①-0 QR로 입장 중 | 없음 |
| `/e/:code/preparing` | ①-1 사진 정리 중 | 입장 |
| `/e/:code/home` | ② 사람별 사진, ②-2 내 사진 바로가기 | 입장 + open |
| `/e/:code/all` | ⑦ 전체 사진 | 입장 |
| `/e/:code/camera` | ②-1 동의, ③ 촬영, ③-1 찾는 중 | 입장 + open |
| `/e/:code/candidates` | ④ 후보, ④-1, ④-2 | 입장 + open |
| `/e/:code/photos?persons=3,12` | ⑤ 사진(합쳐 보기), ⑤-1 선택, ⑤-2 저장 중 | 입장 + open |
| `/e/:code/photos/:photoId` | ⑥ 크게 보기 | 입장 + open |
| `/expired` | ⑧ 입장 시간 만료 | 없음 |
| `/admin/login` | A1, A1-1 | 없음 |
| `/admin/events` | A2 최근 행사 | 관리자 |
| `/admin/events/new` | A3 새 행사 + QR | 관리자 |
| `/admin/events/:id/upload` | A4, A4-1 | 관리자 |
| `/admin/events/:id/processing` | A5 | 관리자 |
| `/admin/events/:id/result` | A6 | 관리자 |
| `/admin/events/:id/persons/:personId` | A7 | 관리자 |

PC 화면(P1~P5)과 관리자 휴대폰 화면(M1~M3)은 같은 페이지의 반응형으로 처리합니다.

## 6. API 목록 (백엔드 명세)

| # | Method | Endpoint | 쓰는 화면 |
|---|---|---|---|
| 1 | POST | `/api/admin/login` | A1 |
| 2 | POST | `/api/admin/events` | A3 |
| 3 | POST | `/api/admin/events/{eventId}/photos` | A4 |
| 4 | POST | `/api/admin/events/{eventId}/upload-complete` | A4-1 |
| 5 | GET | `/api/admin/events/{eventId}` | A2, A5, A6 |
| 6 | POST | `/api/events/join` | ①-0, ①, ①-1 |
| 7 | GET | `/api/events/{eventId}/photos?page&size` | ⑦ |
| 8 | POST | `/api/events/{eventId}/match` | ③-1 → ④ |
| 9 | GET | `/api/events/{eventId}/persons/{personId}/photos` | ⑤, ⑥, A7 |
| 10 | GET | `/api/events/{eventId}/persons?minPhotos` | ②, A6 |

---

## 7. 단계별 작업

### 0단계. 프로젝트 준비 ✅ (2026-10-23 완료)
- [x] `frontend/`에 Vite + React + TypeScript 프로젝트 생성 (create-vite 9.3: Vite 8, React 19.3, TypeScript 6)
- [x] 폴더 구조(4장) 만들기
- [x] 린트(oxlint, 템플릿 기본) + Prettier 설정. 저장 시 포맷은 VS Code 추천 확장으로 안내
- [x] `@/` 경로 별칭 (tsconfig + vite)
- [x] TypeScript `strict`
- [x] 환경 변수: `.env.development` (`VITE_API_BASE_URL`, `VITE_USE_MOCK=true`), `.env.production`, `.env.example`
- [x] git 초기화(작업 폴더 = 팀 저장소, `frontend` 브랜치), `frontend/`만 추적

**끝났을 때 확인할 것:** `npm run dev`로 빈 화면이 뜨고, `npm run lint`·`npm run build`가 통과한다. → 확인 완료

### 1단계. 디자인 시스템 ✅ (2026-10-23 완료)
- [x] Tailwind v4 설치, `tokens.css` 적용
- [x] Pretendard 가변 글꼴 적용
- [x] shadcn/ui 초기화, 필요한 컴포넌트 추가 (Button, Input, Label, Checkbox, Drawer, Dialog, AlertDialog, Sonner, Progress, Badge, Card, Skeleton, Carousel)
- [x] 버튼 변형을 명세서(8.2)에 맞게 수정: default, secondary(연한 인디고), ghost, destructive, link / 크기 lg 56, default 44, sm 36, icon 44
- [x] Lucide 설치
- [x] 공통 컴포넌트: AppLogo, EventStatusBadge(`entities/event`), EmptyState, ErrorState, FaceCrop, PhotoPlaceholder
- [x] 개발용 컴포넌트 모음 페이지 (`/dev/ui`)

**끝났을 때 확인할 것:** 컴포넌트 모음 페이지의 색·글꼴·버튼·배지가 시안·명세서와 같다. → 확인 완료 (브라우저에서 계산된 값 확인: 버튼 높이 56/44/36/44, 입력칸 글자 16px, 배지 색, 토스트 남색·아래 가운데, FaceCrop 자르기·실패 아이콘, 375px 폭에서 가로 스크롤 없음)

### 2단계. API 계층 + 가짜 서버 ✅ (2026-10-23 완료)
- [x] API 10개 요청·응답 타입 (`entities/session·event·photo·person`)
- [x] `client.ts`: 기본 주소, 토큰 헤더, 공통 응답 해석, 오류를 `ApiError(code, status)`로 변환, 401 처리 연결점
- [x] `error-messages.ts`: 오류 코드 → 한국어 문구
- [x] 토큰·세션 저장소 (관리자/참가자, sessionStorage)
- [x] TanStack Query 설정(`query-client.ts`), 쿼리 키 (Provider 연결은 3단계)
- [x] MSW: 10개 API 핸들러, 샘플 데이터(행사 4개 상태별, 사람 48명, 사진 100장), 일러스트 사진, 처리 진행률 시뮬레이션
- [x] 오류 상황 재현 패널 (셀카 결과, 응답 속도, 다음 요청 실패, 이미지·토큰 만료, 초기화)

**끝났을 때 확인할 것:** 화면 없이 각 API를 호출해 가짜 데이터와 오류가 명세 형식대로 온다. → 확인 완료 (Vitest 58개: 클라이언트·오류 문구·토큰·재시도 규칙·가짜 API 24개 시나리오. 브라우저에서도 10개 API 직접 호출, 일러스트 사진·bbox 위치, 패널 설정·초기화 확인. 빌드 결과에 가짜 API 코드·서비스 워커 없음 확인)

### 3단계. 라우팅·레이아웃
- [ ] 라우트(5장) 등록, 관리자 묶음 lazy 로딩
- [ ] 가드: 입장, open 여부, 관리자
- [ ] 참가자 레이아웃(휴대폰 우선, PC는 헤더형), 관리자 레이아웃(왼쪽 메뉴 → 휴대폰에서 위쪽 메뉴)
- [ ] 라우트별 오류 경계, 404 화면
- [ ] 401 → 참가자는 ⑧, 관리자는 A1로

**끝났을 때 확인할 것:** 주소를 바꾸면 레이아웃 안에서 빈 화면이 바뀌고, 토큰이 없으면 가드가 돌려보낸다.

### 4단계. 참가자: 입장 · 사람별 사진
- [ ] ① 입장 (코드 대문자 변환, 오류 ①-2), 관리자 페이지 링크
- [ ] ①-0 QR로 입장 중 (`/e/:code`에서 자동 입장)
- [ ] ①-1 사진 정리 중 (15초마다 자동 확인, [지금 확인하기])
- [ ] ② 사람별 사진 (#10 `minPhotos=2`, FaceCrop 격자, "셀카로 빨리 찾기")
- [ ] ②-2 내 사진 바로가기 (찾은 폴더 기억)
- [ ] ⑦ 전체 사진 (#7 페이지 단위 무한 스크롤)
- [ ] ⑧ 입장 시간 만료
- [ ] PC 화면 P1·P2 반응형

**끝났을 때 확인할 것:** 코드 입력부터 사람별 사진·전체 사진까지 가짜 데이터로 이어진다.

### 5단계. 참가자: 셀카로 찾기
- [ ] ②-1 동의 시트 (한 번 동의하면 다시 묻지 않음)
- [ ] `useCamera`: getUserMedia, 상태(idle → requesting → ready → captured / denied / unsupported), 화면 떠날 때 카메라 끄기
- [ ] 권한 거부 안내, 인앱 브라우저(카카오톡 등) 안내
- [ ] ③ 촬영: 미리보기 좌우 반전, 얼굴 가이드, 1024px JPG로 줄여서 전송
- [ ] ③-1 찾는 중
- [ ] ④ 후보 여러 명 선택 → ⑤로 personId 목록 전달
- [ ] ④-1 후보 없음, ④-2 얼굴 못 찾음
- [ ] PC P3·P4 (웹캠, QR로 휴대폰 이어서 하기)

**끝났을 때 확인할 것:** 실제 휴대폰(HTTPS)에서 카메라가 켜지고, 찍으면 후보가 나온다.

### 6단계. 참가자: 사진 보기 · 저장
- [ ] ⑤ 여러 폴더 사진 합쳐 보기 (중복 제거, 대표 얼굴 겹쳐 표시)
- [ ] ⑤-1 선택 모드 ([선택] 버튼, 길게 누르기 보조, 전체 선택)
- [ ] ⑥ 크게 보기 (좌우 넘기기, 두 번 탭·두 손가락 확대, 앞뒤 미리 불러오기)
- [ ] 저장: 휴대폰은 공유 시트(Web Share), 안 되면 차례로 다운로드 / PC는 차례로 다운로드
- [ ] ⑤-2 저장 진행 시트, 완료 토스트
- [ ] 이미지 주소 만료(응답의 `expiresIn`) 시 목록 다시 불러오기
- [ ] PC P5 반응형

**끝났을 때 확인할 것:** 사진을 골라 저장할 수 있고, PC 너비에서도 시안처럼 보인다.

### 7단계. 관리자
- [ ] A1 로그인, A1-1 실패
- [ ] A2 최근 행사 (localStorage + #5로 상태 표시)
- [ ] A3 새 행사 + 인증코드·QR 창 (QR 그리기, 링크 복사, QR 이미지 저장)
- [ ] 업로드: `UploadQueue` (2000px 리사이즈, 1장씩, 동시 4장, 재시도 3번, 진행률), 끌어다 놓기·폴더 선택, 창 닫기 경고
- [ ] A4 업로드 중 / A4-1 완료 확인 창
- [ ] A5 정리 중 (#5 3초마다, 단계 표시, 실패 목록, 완료 알림·탭 제목)
- [ ] A6 분류 결과 (#10, "한 장에만 나온 사람 숨기기" 토글)
- [ ] A7 사람 폴더 사진 (#9)
- [ ] 휴대폰 관리자 M1~M3 반응형

**끝났을 때 확인할 것:** 행사 만들기 → 업로드 → 정리 → 결과 확인이 가짜 데이터로 이어진다.

### 8단계. 다듬기
- [ ] 모든 목록의 로딩·빈 화면·오류 화면
- [ ] 명세서 출시 전 체크리스트 (대비, 44px, 포커스, 동작 줄이기, 입력 16px, 가로 스크롤 없음)
- [ ] Vitest: UploadQueue, 이미지 리사이즈, 오류 변환, 폴더 합치기
- [ ] 실제 기기 확인: 아이폰 Safari, 안드로이드 Chrome, 카카오톡 인앱 브라우저

**끝났을 때 확인할 것:** 체크리스트와 테스트를 통과한다.

### 9단계. 실제 API 연결 · 배포 준비 (백엔드 준비 후)
- [ ] 가짜 API 끄고 실제 서버 연결 (입장 → 업로드 → 검색 순서)
- [ ] nginx 설정 초안 (`try_files`, `/api` 넘기기, 캐시 규칙)
- [ ] `npm run build` + `vite preview` 확인
- [ ] SourceDeploy용 zip

---

## 8. 백엔드·인프라 확인 대기

| 항목 | 상태 |
|---|---|
| `status`를 `open`으로 바꾸는 시점이 Object Storage 저장 완료 이후인지 | 확인 전 |
| 관리자·참가자 토큰 만료 12~24시간으로 연장 | 요청함 |
| 사진 저장소 버킷 읽기(GET) CORS 허용 (저장·공유용) | 인프라 요청 필요 |
| 도메인 + HTTPS 인증서 (카메라 필수) | 인프라 확인 필요 |
| #7 전체 사진에 `downloadUrl` 추가 (시안 ⑦ → ⑥ 크게 보기에 저장·공유 버튼이 있음. 없으면 버킷 CORS 필요) | 백엔드 요청 필요 |
| 이미지 URL 만료 시간 불일치: `CLAUDE.md` 600초 / `docs/api.md` 3600초 (프론트는 응답의 `expiresIn`을 따름) | 백엔드 확인 필요 |
| #6 참가자 입장 응답에 `expiresIn` 없음 (#1 관리자 로그인에는 있음) | 백엔드 확인 필요 |
| 업로드 용량 제한(413)을 nginx·ALB가 먼저 막으면 JSON이 아닌 응답이 옴 → 앞단 제한 값 확인 (프론트는 상태 코드로 `FILE_TOO_LARGE` 처리) | 인프라 확인 필요 |
| #7 전체 사진을 공개(`open`) 전에 부르면 어떻게 되는지 명세에 없음 (가짜 API는 `EVENT_NOT_READY`로 가정) | 백엔드 확인 필요 |
| 참가자 입장 코드가 대소문자를 구분하는지 (프론트는 대문자로 바꿔 보냄, 가짜 API는 그대로 비교) | 백엔드 확인 필요 |

## 9. 결정 기록

| 날짜 | 단계 | 결정 |
|---|---|---|
| 2026-10-23 | 계획 | 이 문서 작성. 0~8단계는 가짜 API로 진행, 9단계는 백엔드 준비 후 |
| 2026-10-23 | 0 | 팀 저장소 `najunho04/face-based-photo-sorter`에 `frontend/` 폴더만 추가. 작업 폴더를 저장소로 쓰고, 루트의 다른 파일은 `.git/info/exclude`로 제외(팀 저장소 루트에 파일을 남기지 않기 위해) |
| 2026-10-23 | 0 | `main`은 건드리지 않고 `frontend` 브랜치에서 작업. `main`이 아직 없어 독립 브랜치로 시작 |
| 2026-10-23 | 0 | 단계·작은 작업마다 커밋, push는 요청 시에만 |
| 2026-10-23 | 0 | 문서(`docs/`)와 디자인 명세서를 `frontend/docs/`로 이동 |
| 2026-10-23 | 0 | 린트는 create-vite 9 기본인 oxlint 사용(ESLint 대신). Prettier 스타일은 템플릿에 맞춰 세미콜론 없음·작은따옴표 |
| 2026-10-23 | 0 | 줄바꿈 LF 통일(`.gitattributes`) |
| 2026-10-23 | 1 | Pretendard는 npm 패키지(dynamic subset)로 포함. 토스트는 어두운 남색(#1E1B4B), 아래 가운데, 4초 |
| 2026-10-23 | 1 | 백엔드가 저장소를 초기화함(`main`). `frontend` 브랜치를 `main` 위로 옮김(rebase, push 전). `frontend/.gitignore`·`.env.example`은 백엔드 버전과 합침 |
| 2026-10-23 | 1 | `CLAUDE.md` 규칙 적용 범위: 풀네임·주석은 전체, TDD는 로직만 |
| 2026-10-23 | 1 | 환경 변수 파일은 `.env.example`만 커밋. 기본값은 코드(`environment.ts`): 설정이 없으면 개발 서버는 가짜 API, 빌드는 실제 API |
| 2026-10-23 | 1 | API 명세 기준을 저장소 `docs/api.md`로 변경. 이미지 URL 만료 3600초, 업로드는 요청당 3~5장 권장으로 반영되어 있음 |
| 2026-10-23 | 1 | 행사 상태 배지는 행사에 딸린 표시라 `entities/event/EventStatusBadge`에 둠. 이름은 시안 기준(업로드 중·얼굴 찾는 중·사람별로 묶는 중: 정보 / 공개 중: 성공). MASTER.md의 옛 StatusBadge(검수 대기·분류 중·만료)도 시안에 맞춰 고침 |
| 2026-10-23 | 1 | FaceCrop: 원본 크기를 몰라도 되게 CSS transform(이동 후 확대)으로 bbox 주변을 1.4배 여유 두고 동그랗게 자름. 불러오기 실패 시 사람 아이콘, 주소가 바뀌면 다시 불러오기 |
| 2026-10-23 | 1 | 로딩 버튼은 클릭만 막고 원래 색 유지(비활성 회색으로 바꾸지 않음, 명세서 8.2 "글자 유지") |
| 2026-10-23 | 1 | 컴포넌트 모음 `/dev/ui`는 `pages/dev/`에 두고 개발 서버에서만 불러옴(빌드 결과에 없음 확인). 3단계 라우터 전까지 `App`에서 주소를 직접 확인 |
| 2026-10-23 | 1 | shadcn Carousel 원본의 oxlint 경고(set-state-in-effect) 1건은 그대로 둠 |
| 2026-10-23 | 2 | push 규칙 변경: 요청 시에만 → 어느 정도 작업이 쌓이면 알아서 push (강제 push 없음) |
| 2026-10-23 | 2 | 가짜 사진은 코드로 그린 일러스트 JPG(실제 인물 없음, 사람마다 얼굴 색·머리 모양이 달라 구분 가능) |
| 2026-10-23 | 2 | 오류 상황 재현은 개발용 떠 있는 패널(가짜 API를 켰을 때만 보임) |
| 2026-10-23 | 2 | 참가자 토큰은 sessionStorage, '내 사진 바로가기'(사람 번호)·동의 여부는 localStorage에 행사별로. 셀카 사진은 어디에도 저장하지 않음 |
| 2026-10-23 | 2 | Vitest를 8단계 대신 2단계에서 설치(TDD 대상인 API 클라이언트·오류 변환이 2단계에 있음). 테스트도 MSW 핸들러를 그대로 사용 |
| 2026-10-23 | 2 | 오류 분기는 HTTP 상태가 아닌 `error.code`로(`LOGIN_FAILED`도 401). JSON이 아닌 응답·네트워크 끊김·시간 초과는 프론트 전용 코드로 변환. 문구는 코드별 프론트 문구 → 서버 `message` → 일반 문구 순 |
| 2026-10-23 | 2 | 이미지 만료 시간은 숫자를 박지 않고 응답의 `expiresIn` 사용 |
| 2026-10-23 | 2 | 업로드 요청당 장 수(계획 1장 / api.md 3~5장)는 7단계에서 정함. 가짜 핸들러는 여러 장을 받음 |
| 2026-10-23 | 2 | MSW 3(2026-09 출시)의 Vite 플러그인(`msw/vite`) 사용: 서비스 워커 파일을 `public/`에 복사하지 않고 개발 서버가 내려줌. 가짜 API는 개발 서버에서만(빌드는 항상 실제 API) |
| 2026-10-23 | 2 | 응답 대기 시간: 기본 15초, 셀카 검색 30초, 업로드 60초. 화면을 떠나 취소한 요청은 오류로 바꾸지 않음 |
| 2026-10-23 | 2 | 가짜 데이터: 샘플 행사 1~3번은 상태 고정(공개·묶는 중·얼굴 찾는 중 63/100), 4번 '동아리 MT'와 새로 만든 행사는 업로드·완료가 실제로 동작. 완료 후 장당 0.3초 → 묶기 5초 → 공개. 13번째 사진은 실패로 만듦(시안 A5 예시) |
| 2026-10-23 | 2 | 사람·사진 id는 `행사 번호 × 10000 + 행사 안 번호`(가짜 API 안에서만 쓰는 규칙, 화면은 id 모양에 기대지 않음) |
| 2026-10-23 | 3 | React Router 8.5 사용(2026-06 출시, v7에서 낡은 기능을 뺀 버전). Data 방식(`createBrowserRouter`)으로 가드는 loader에서 redirect |
| 2026-10-23 | 3 | 입장 정보 없이 `/e/:code/...`로 들어오면 주소의 코드로 자동 입장(①-0) 후 원래 화면으로 돌아감(`/e/:code?next=원래 주소`) |
| 2026-10-23 | 3 | 참가자 401 → ⑧ 안내, [다시 입장하기]는 기억해 둔 코드로 바로 재입장(코드 재입력 없음, `/expired?code=`) |
| 2026-10-23 | 3 | 관리자 휴대폰 ☰ 메뉴는 아래에서 올라오는 시트(최근 행사·새 행사 만들기·로그아웃) |
| 2026-10-23 | 3 | 레이아웃은 명세서 7장 기준: 휴대폰(<768) 공통 머리글 없음, 태블릿 560px 가운데, PC(≥1024) 참가자 머리글·관리자 왼쪽 메뉴 232px. 크게 보기(⑥)는 레이아웃 밖 전체 화면 |
| 2026-10-23 | 3 | 공개 여부는 입장 응답의 status를 세션에 저장해 가드가 확인(공개 전이면 ①-1). 관리자 401 → A1(로그인 후 원래 화면) |
