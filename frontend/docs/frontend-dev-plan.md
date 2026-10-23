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
| API 명세 (백엔드) | https://app.notion.com/p/API-4020ea4df7858001a2a6f14efcfd123d |
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
- 팀 저장소에는 `frontend/` 폴더만 올린다. `main`은 건드리지 않고 `frontend` 브랜치에서 작업한 뒤 나중에 머지한다.
- 단계마다, 또는 작은 작업이 끝날 때마다 커밋한다. push는 따로 요청할 때만 한다.
- `main`이 아직 없어서 `frontend` 브랜치는 독립적으로 시작했다. 머지할 때 `--allow-unrelated-histories`가 필요하다.

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
  features/
    camera/          useCamera, CameraView, ShutterButton, 권한·인앱 안내
    selfie-search/   검색 요청, 후보 선택
    photo-selection/ 선택 모드, 저장·공유, 진행 표시
    upload/          UploadQueue(순수 TS), useUploadQueue, Dropzone, 리사이즈
    publish/         인증코드·QR 창
  entities/
    event/  photo/  person/   타입, 쿼리 키, API 함수, 작은 표시 컴포넌트
  shared/
    ui/      shadcn 컴포넌트 + AppLogo, FaceCrop, StatusBadge, EmptyState, ErrorState
    api/     client.ts, errors.ts
    lib/     image.ts, download.ts, share.ts, storage.ts
    styles/  tokens.css, index.css
  mocks/   MSW 핸들러, 샘플 데이터, 자리 표시 이미지
```

규칙: **위에서 아래로만 import** (app → pages → features → entities → shared). features끼리는 서로 import하지 않음.

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

### 1단계. 디자인 시스템
- [ ] Tailwind v4 설치, `tokens.css` 적용
- [ ] Pretendard 가변 글꼴 적용
- [ ] shadcn/ui 초기화, 필요한 컴포넌트 추가 (Button, Input, Label, Checkbox, Drawer, Dialog, AlertDialog, Sonner, Progress, Badge, Card, Skeleton, Carousel)
- [ ] 버튼 변형을 명세서(8.2)에 맞게 수정: default, secondary(연한 인디고), ghost, destructive, link / 크기 lg 56, default 44, sm 36, icon 44
- [ ] Lucide 설치
- [ ] 공통 컴포넌트: AppLogo, StatusBadge, EmptyState, ErrorState, FaceCrop, PhotoPlaceholder
- [ ] 개발용 컴포넌트 모음 페이지 (`/dev/ui`)

**끝났을 때 확인할 것:** 컴포넌트 모음 페이지의 색·글꼴·버튼·배지가 시안·명세서와 같다.

### 2단계. API 계층 + 가짜 서버
- [ ] API 10개 요청·응답 타입
- [ ] `client.ts`: 기본 주소, 토큰 헤더, 공통 응답 해석, 오류를 `ApiError(code, status)`로 변환, 401 처리 연결점
- [ ] `errors.ts`: 오류 코드 → 한국어 문구
- [ ] 토큰·세션 저장소 (관리자/참가자, sessionStorage)
- [ ] TanStack Query 설정, 쿼리 키
- [ ] MSW: 10개 API 핸들러, 샘플 데이터(행사 4개 상태별, 사람 48명, 사진 100장), 자리 표시 이미지, 처리 진행률 시뮬레이션
- [ ] 오류 상황 재현 스위치 (예: 잘못된 코드, 얼굴 없음, 후보 0명)

**끝났을 때 확인할 것:** 화면 없이 각 API를 호출해 가짜 데이터와 오류가 명세 형식대로 온다.

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
- [ ] 이미지 주소 만료(600초) 시 목록 다시 불러오기
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
