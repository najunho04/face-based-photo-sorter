# 인생내컷 디자인 명세서 (MASTER)

> 이 문서가 디자인의 기준입니다. 화면별로 다른 규칙이 필요하면 `pages/<화면>.md`에 적고, 그 파일이 이 문서보다 우선합니다.
> 실제 코드에서 쓰는 색·글꼴·간격 값은 같은 폴더의 `tokens.css`에 있습니다.

- 작성일: 2026-10-16
- 기준 시안: [화면 시안 캔버스](https://claude.ai/artifact/W4Q5p2VuNAvjgpFbd2sWt5) (색은 이 문서 기준으로 바뀔 예정)
- 참고: UI UX Pro Max 스킬(`tools/ui-ux-pro-max-skill`), Color Hunt

---

## 1. 결정 사항 요약

| 항목 | 결정 |
|---|---|
| 서비스 이름 | 인생내컷 |
| 스타일 | 미니멀 (스킬 추천: Minimalism & Swiss Style) — 사진이 주인공, UI는 조용하게 |
| 메인 컬러 | D. 인디고 + 그린 (인디고 `#4F46E5` 주요색, 그린은 성공·확인 표시) |
| 글꼴 | Pretendard |
| 화면 모드 | 라이트 모드만 (카메라·사진 크게 보기 화면만 어두운 배경) |
| 컴포넌트 | shadcn/ui 기반 + 서비스 전용 컴포넌트 직접 제작 |
| 아이콘 | Lucide (`lucide-react`) |
| 모서리 | 보통 — 버튼·입력 12px, 카드 16px |
| 보조 버튼 | 연한 인디고 배경 (`#EEF2FF`) + 진한 인디고 글자 |
| 사진 격자 | 모서리 없음, 간격 2px (휴대폰 갤러리 방식) |
| 애니메이션 | 최소한 (버튼 눌림, 시트 열기, 화면 전환만) |
| 로고 | 글자만 — "인생내컷", Pretendard Bold, 인디고 |

### 디자인 원칙
1. **사진이 주인공이다.** UI 색은 인디고 하나만 강조로 쓰고, 나머지는 흰색과 회색으로 비운다.
2. **한 화면에 주요 행동 하나.** 채워진 인디고 버튼(주 버튼)은 화면마다 하나만 둔다.
3. **불안하지 않게.** 얼굴 정보를 다루는 서비스라서, 삭제·보관 기간 안내를 숨기지 않고 짧게 보여준다.
4. **엄지로 쓸 수 있게.** 참가자 화면의 주요 버튼은 화면 아래쪽, 높이 56px.

---

## 2. 색상

모든 글자 색은 WCAG AA 대비(본문 4.5:1 이상)를 계산해서 확인했습니다. 대비 값은 표 오른쪽에 적었습니다.

### 2.1 브랜드 색

| 이름 | 값 | 쓰임 | 대비 |
|---|---|---|---|
| `primary` | `#4F46E5` | 주 버튼 배경, 선택 테두리, 링크, 로고 | 흰 글자 6.29 |
| `primary-hover` | `#4338CA` | 주 버튼 마우스 올림 | 흰 글자 7.90 |
| `primary-pressed` | `#3730A3` | 주 버튼 눌림 | — |
| `primary-soft` | `#EEF2FF` | 보조 버튼 배경, 선택된 카드 배경, 칩 배경 | — |
| `primary-soft-hover` | `#E0E7FF` | 보조 버튼 마우스 올림 | — |
| `primary-soft-fg` | `#3730A3` | 보조 버튼·칩 글자 | `#EEF2FF` 위 8.88 |
| `primary-border` | `#C7D2FE` | 선택 안 된 후보 얼굴 테두리, 장식 선 | 장식용 |
| `on-primary` | `#FFFFFF` | 주 버튼 글자 | — |

### 2.2 중립 색

| 이름 | 값 | 쓰임 | 대비 (흰 바탕) |
|---|---|---|---|
| `foreground` | `#1E1B4B` | 기본 글자 (인디고가 살짝 섞인 검정) | 15.99 |
| `text-secondary` | `#4B5563` | 보조 설명 글자 | 7.56 (회색 바탕 7.00) |
| `text-muted` | `#6B7280` | 날짜, 캡션, 입력 예시 글자 | 4.83 — **흰 바탕에서만** 사용 (회색 바탕 4.48로 미달) |
| `background` | `#FFFFFF` | 기본 바탕 | — |
| `surface` | `#F5F6FA` | 관리자 화면 바탕, 안내 상자 | — |
| `border` | `#E5E7EB` | 카드·구분선 (장식) | — |
| `input-border` | `#8A919E` | 입력칸·체크박스 테두리 | 3.17 (UI 요소 기준 3:1 충족) |
| `overlay` | `rgba(17, 24, 39, 0.5)` | 시트·다이얼로그 뒤 어둡게 | — |

### 2.3 상태 색

| 이름 | 글자 | 배경 | 채움(흰 글자) | 쓰임 |
|---|---|---|---|---|
| 성공 `success` | `#15803D` (4.79) | `#F0FDF4` | `#15803D` (5.02) | 업로드 완료, 본인 확인 안내, "공개 중" 배지 |
| 경고 `warning` | `#B45309` (4.84) | `#FFFBEB` | — | "검수 대기" 배지, 만료 임박 안내 |
| 위험 `danger` | `#B91C1C` (5.91) | `#FEF2F2` | `#DC2626` (4.83) | 업로드 실패, 삭제 요청, 오류 |
| 정보 `info` | `#3730A3` | `#EEF2FF` | — | "분류 중" 배지, 일반 안내 (= primary-soft) |
| 비활성 `neutral` | `#4B5563` | `#F3F4F6` | — | "만료" 배지 |

> 원래 팔레트의 그린 `#16A34A`는 흰 글자 대비가 3.30으로 부족해서, 채움과 글자 모두 한 단계 진한 `#15803D`로 바꿨습니다. `#16A34A`는 진행 막대처럼 글자가 없는 곳에만 씁니다.

### 2.4 어두운 화면 (카메라, 사진 크게 보기)
라이트 모드만 지원하지만, 사진과 카메라에 집중하는 두 화면은 어두운 배경을 씁니다.

| 이름 | 값 | 대비 |
|---|---|---|
| `dark-bg` | `#0B0B12` | — |
| `dark-surface` | `#1F1F2A` | — |
| `dark-fg` | `#FFFFFF` | 19.61 |
| `dark-fg-secondary` | `#A1A1AA` | 7.65 |

### 2.5 사용 규칙
- 컴포넌트 코드에 hex 값을 직접 쓰지 않고, 항상 `tokens.css`의 변수(Tailwind 클래스)를 씁니다.
- 색만으로 의미를 전달하지 않습니다. 상태 배지에는 반드시 글자("공개 중")를 함께 씁니다.
- 사진 자리 표시(로딩 중 썸네일)는 `#EEF0F4` 단색입니다.

---

## 3. 글꼴

### 3.1 글꼴
- **Pretendard** (가변 글꼴, 한 파일로 모든 굵기)
- 불러오기: jsDelivr CDN의 `pretendardvariable-dynamic-subset.min.css` (쓰는 글자만 내려받는 방식이라 가벼움). 버전은 설치할 때 고정합니다.
- 대체 글꼴: `-apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- 숫자(사진 수, 진행률)는 `font-variant-numeric: tabular-nums`로 자릿수 폭을 맞춥니다.

### 3.2 글자 크기 단계

| 이름 | 크기 / 줄 높이 | 굵기 | 쓰임 |
|---|---|---|---|
| `display` | 28 / 36 | 700 | 참가자 입장 화면 큰 제목 |
| `title-1` | 24 / 32 | 700 | 화면 제목 ("내 사진 23장") |
| `title-2` | 20 / 28 | 700 | 시트·다이얼로그 제목, 관리자 화면 제목 |
| `headline` | 17 / 24 | 600 | 카드 제목, 행사 이름 |
| `body` | 16 / 24 | 400 | 본문, 입력칸 글자 |
| `body-strong` | 16 / 24 | 600 | 버튼 글자, 강조 본문 |
| `small` | 14 / 20 | 400 | 보조 설명, 목록 항목 |
| `caption` | 12 / 16 | 500 | 날짜, 배지, 사진 수 |

규칙:
- **입력칸 글자는 반드시 16px 이상.** 아이폰 Safari는 16px 미만 입력칸을 누르면 화면을 확대합니다.
- 12px보다 작은 글자는 쓰지 않습니다.
- 굵기는 400, 500, 600, 700 네 가지만 씁니다.
- 한국어 문장은 `word-break: keep-all`로 단어 중간에서 줄이 바뀌지 않게 합니다.

---

## 4. 간격, 모서리, 그림자

### 4.1 간격 (4px 단위)

| 이름 | 값 | 주로 쓰는 곳 |
|---|---|---|
| `space-1` | 4px | 아이콘과 글자 사이 |
| `space-2` | 8px | 칩 안쪽, 작은 요소 사이 |
| `space-3` | 12px | 목록 항목 사이, 카드 사이 |
| `space-4` | 16px | 카드 안쪽, 휴대폰 화면 좌우 여백 (관리자 휴대폰) |
| `space-5` | 20px | 휴대폰 화면 좌우 여백 (참가자) |
| `space-6` | 24px | 섹션 사이, 시트 안쪽 |
| `space-8` | 32px | 큰 섹션 사이 |
| `space-10` | 40px | PC 화면 위아래 여백 |
| `space-12` | 48px | PC 관리자 화면 좌우 여백 |

### 4.2 모서리

| 이름 | 값 | 쓰임 |
|---|---|---|
| `radius-sm` | 8px | 작은 버튼(36px 이하), 툴팁, 진행 막대 |
| `radius-md` | 12px | 버튼, 입력칸, 안내 상자 (**기본값**) |
| `radius-lg` | 16px | 카드, 다이얼로그 |
| `radius-xl` | 24px | 바닥 시트 위쪽 모서리 |
| `radius-full` | 9999px | 배지, 칩, 얼굴 동그라미, 촬영 버튼 |
| (없음) | 0 | 사진 격자 썸네일 |

### 4.3 그림자 (아주 적게)

| 이름 | 값 | 쓰임 |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(17,24,39,.06)` | 마우스 올린 카드 (PC만) |
| `shadow-md` | `0 6px 16px rgba(17,24,39,.12)` | 떠 있는 "새 행사" 버튼 |
| `shadow-lg` | `0 12px 32px rgba(17,24,39,.16)` | 다이얼로그 (PC) |

평소 카드는 그림자 없이 `border` 선만 씁니다.

---

## 5. 아이콘 (Lucide)

- 패키지: `lucide-react`
- 기본 크기 20px, 선 굵기 2. 헤더·탭 버튼은 24px, 칩 안은 16px.
- 색은 글자 색을 따라갑니다(`currentColor`).
- 아이콘만 있는 버튼은 `aria-label` 필수, 눌리는 영역은 44×44px 이상.
- 장식용 아이콘은 `aria-hidden="true"`.
- 이모지를 아이콘 대신 쓰지 않습니다.

| 용도 | 아이콘 |
|---|---|
| 촬영, 로고 옆 사진 | `Camera` |
| 카메라 전환 | `SwitchCamera` |
| 저장 / 다운로드 | `Download` |
| 공유 | `Share2` |
| 더보기 | `Ellipsis` |
| 뒤로 | `ChevronLeft` |
| 닫기 | `X` |
| 선택됨 | `Check` |
| 업로드 | `Upload` |
| 사진 더 추가 | `ImagePlus` |
| QR | `QrCode` |
| 폴더 합치기 | `Merge` |
| 삭제 요청 | `Trash2` |
| 보관 기간 | `Clock` |
| 개인정보 안내 | `ShieldCheck` |
| 경고·오류 | `CircleAlert` |
| 로딩 | `LoaderCircle` (회전) |
| 메뉴 (관리자 휴대폰) | `Menu` |
| 다시 시도 | `RotateCw` |
| PC 화면 안내 | `Monitor` |

---

## 6. 움직임 (최소한)

| 이름 | 시간 | 곡선 | 쓰임 |
|---|---|---|---|
| `duration-fast` | 150ms | ease-out | 버튼 눌림(살짝 작아짐 scale 0.98), 색 변화 |
| `duration-base` | 200ms | ease-out | 페이드, 토스트 등장 |
| `duration-sheet` | 250ms | `cubic-bezier(0.32, 0.72, 0, 1)` | 바닥 시트 올라오기 |

규칙:
- `transform`과 `opacity`만 움직입니다. 너비·높이를 애니메이션하지 않습니다.
- 사용자가 기기에서 "동작 줄이기"를 켰으면(`prefers-reduced-motion`) 모든 움직임을 끕니다.
- 결과 사진이 차례로 나타나는 효과, 축하 연출 같은 장식 움직임은 넣지 않습니다.

---

## 7. 레이아웃

| 구분 | 너비 | 규칙 |
|---|---|---|
| 휴대폰 | 768px 미만 | 한 줄 배치, 좌우 여백 20px, 주 버튼은 화면 아래 고정 |
| 태블릿 | 768~1023px | 휴대폰 배치를 가운데 정렬, 최대 너비 560px |
| PC | 1024px 이상 | 내용 최대 너비 1120px 가운데 정렬. 관리자는 왼쪽 메뉴(232px) + 본문 |

- 아이폰 아래쪽 홈 막대 영역을 피하도록 `env(safe-area-inset-bottom)`만큼 아래 여백을 더합니다.
- 화면 높이는 `100dvh`를 씁니다(휴대폰 주소창이 줄었다 늘었다 해도 맞음).
- 가로 스크롤이 생기지 않아야 합니다. 넓은 표는 상자 안에서만 가로로 스크롤합니다.
- 사진 격자 열 수: 휴대폰 3열, 태블릿 4열, PC 6열(최소 160px).

---

## 8. 컴포넌트

### 8.1 shadcn/ui에서 가져오는 것

설치 후 `tokens.css` 색이 자동으로 적용됩니다. 아래는 우리 서비스에 맞춘 사용 규칙입니다.

| 컴포넌트 | 쓰는 곳 | 우리 규칙 |
|---|---|---|
| `Button` | 모든 버튼 | 변형 5종(아래 8.2) |
| `Input`, `Label` | 인증코드, 로그인, 행사 만들기 | 높이 56px(참가자) / 44px(관리자), 라벨은 항상 위에 보이게 (입력 예시만으로 라벨 대신하지 않음) |
| `Checkbox` | 동의, 사진·폴더 선택 | 20px, 체크 시 `primary` |
| `Drawer` (바닥 시트) | 휴대폰: 동의 안내, 더보기 메뉴 | 위 모서리 24px, 손잡이 막대 표시 |
| `Dialog` | PC: 확인 창, 공개 QR | 최대 너비 440px |
| `AlertDialog` | 폴더 합치기, 삭제 요청, 공개하기 확인 | 위험한 동작은 `destructive` 버튼 |
| `Sonner` (토스트) | "저장했어요", "다시 시도해 주세요" | 3~5초 후 자동으로 사라짐, 화면 아래 가운데 |
| `Progress` | 업로드·분류 진행률 | 높이 8px, 업로드는 `success`, 분류는 `primary` |
| `Badge` | 행사 상태, 칩 | 둥근 알약 모양, 상태 색(2.3) |
| `Card` | 행사 카드, 안내 상자 | 테두리만, 그림자 없음 |
| `Skeleton` | 사진 격자·목록 로딩 | `#EEF0F4` |
| `DropdownMenu` | PC: 사진 더보기 | — |
| `Carousel` (Embla) | 사진 크게 보기 좌우 넘기기 | 앞뒤 1장 미리 불러오기 |
| `Form` | 관리자 행사 만들기 | react-hook-form + zod, 오류는 해당 입력칸 바로 아래 |
| `Tooltip` | PC: 아이콘 버튼 설명 | 휴대폰에서는 쓰지 않음 |

### 8.2 버튼 변형

| 변형 | 배경 / 글자 | 쓰임 |
|---|---|---|
| `default` (주 버튼) | `primary` / 흰색 | 화면당 하나: "입장하기", "이게 나예요", "공개하기" |
| `secondary` (보조) | `primary-soft` / `primary-soft-fg` | "전체 저장", "선택 해제", "다시 시도" |
| `ghost` | 투명 / `text-secondary` | "이 중에 없어요", 뒤로가기 |
| `destructive` | `#DC2626` / 흰색 | "삭제 요청 보내기" |
| `link` | 투명 / `primary` | "전체 사진 둘러보기" |

| 크기 | 높이 | 글자 | 쓰임 |
|---|---|---|---|
| `lg` | 56px | 16 / 600 | 참가자 화면 주요 버튼 |
| `default` | 44px | 15 / 600 | 관리자 화면, PC |
| `sm` | 36px | 14 / 600 | 표·목록 안 작은 버튼 (눌리는 영역은 44px 확보) |
| `icon` | 44×44px | — | 아이콘만 있는 버튼 |

상태: 기본, 마우스 올림, 눌림, 키보드 포커스(인디고 2px 테두리 + 2px 간격), 로딩(`LoaderCircle` + 글자 유지, 중복 클릭 막기). 비활성 상태는 되도록 쓰지 않고, 눌렀을 때 이유를 안내합니다.

### 8.3 서비스 전용 컴포넌트

| 컴포넌트 | 하는 일 | 생김새·규칙 |
|---|---|---|
| `AppLogo` | 글자 로고 | "인생내컷", Pretendard 700, `primary`, 16px(헤더) / 20px(PC) |
| `EventHeader` | 행사 이름·날짜·사진 수 | `headline` + `caption`, 칩 하나 |
| `CodeInput` | 인증코드 6자리 입력 | 56px, 글자 간격 넓게, 자동 대문자, `inputmode="text"`, `autocomplete="one-time-code"` |
| `ConsentList` | 동의 전 안내 3줄 | 줄마다 Lucide 아이콘(`Trash2`, `Clock`, `ShieldCheck`) + `body` |
| `CameraView` | 셀카 미리보기 | 어두운 화면, 좌우 반전 미리보기, 얼굴 위치 타원 가이드(흰 점선 3px), 위쪽 안내 문구, 아래 팁 칩 |
| `ShutterButton` | 촬영 버튼 | 76px 원, 흰 테두리 4px + 안쪽 흰 원 58px, `aria-label="촬영"` |
| `CandidateFaceCard` | 후보 얼굴 1개 | 92px 얼굴 원(PC 140px) + "사진 23장". 선택 시 `primary` 3px 테두리 + `primary-soft` 카드 배경 + 오른쪽 위 체크. `role="radio"` 묶음 |
| `PhotoGrid` | 사진 격자 | 모서리 0, 간격 2px, 정사각형(휴대폰) / 4:3(PC), 끝까지 내리면 다음 페이지 |
| `PhotoThumb` | 썸네일 1장 | 지연 로딩, 로딩 중 `#EEF0F4`. 선택 모드에서 왼쪽 위 체크박스 + 선택 시 `primary` 안쪽 테두리 3px |
| `SelectionBar` | 여러 장 선택 시 나타나는 막대 | 휴대폰: 화면 아래 고정, PC: 격자 위. "3장 선택됨" + 보조 버튼들 |
| `PhotoViewer` | 사진 크게 보기 | 어두운 화면, 좌우 넘기기, 아래 막대(저장·공유·더보기), "3 / 23" |
| `ExpiryNotice` | 보관 기간 안내 | `Clock` + "24시간 동안 볼 수 있어요", `caption`, `text-muted` |
| `UploadDropzone` | 사진 끌어다 놓기 | 점선 2px `input-border`, 끌어올리면 `primary` 점선 + `primary-soft` 배경 |
| `UploadProgressPanel` | 업로드·분류 진행률 | 막대 2개(업로드 `success`, 분류 `primary`) + 숫자 "40 / 98장" |
| `UploadFailureList` | 실패한 파일 목록 | `danger` 글자 + 파일명 + 이유 + `secondary` "다시 시도" |
| `StatusBadge` | 행사 상태 | 공개 중(성공), 검수 대기(경고), 분류 중(정보), 만료(비활성) |
| `EventCard` | 행사 목록 카드 | 상태 배지, 날짜, 이름(`headline`), 요약 한 줄, 분류 중이면 진행 막대 |
| `FaceFolderCard` | 검수 화면의 사람 폴더 | 얼굴 원 76px(휴대폰 64px) + "사람 3" + "사진 15장", 왼쪽 위 체크박스 |
| `PublishQRDialog` | 공개 후 코드·QR | 큰 인증코드, QR, "링크 복사"(secondary), "QR 이미지 저장"(secondary) |
| `EmptyState` | 빈 화면 | 아이콘 + 제목 한 줄 + 설명 한 줄 + 행동 버튼 하나 |
| `ErrorState` | 오류 화면 | `CircleAlert` + 무슨 일이 생겼는지 + 무엇을 하면 되는지 + "다시 시도" |
| `InAppBrowserNotice` | 카카오톡 등 인앱 브라우저 안내 | 카메라가 안 열릴 때 "다른 브라우저로 열기" 방법 |
| `PermissionNotice` | 카메라 권한 거부 안내 | 기기별(아이폰/안드로이드) 허용 방법 |

---

## 9. 화면별 컴포넌트

| 화면 | 쓰는 컴포넌트 |
|---|---|
| ① 입장 | `AppLogo`, `CodeInput`, `Button(default, lg)` |
| ② 행사 첫 화면 + 동의 | `EventHeader`, `Button(default, lg)`, `Button(link)`, `Drawer` + `ConsentList` + `Checkbox` |
| ③ 셀카 촬영 | `CameraView`, `ShutterButton`, `Button(icon)`, `PermissionNotice`, `InAppBrowserNotice` |
| ④ 후보 선택 | `CandidateFaceCard` ×3, `Button(default, lg)`, `Button(ghost)` |
| ⑤ 내 사진 | `EventHeader`, `ExpiryNotice`, `Button(secondary)`, `PhotoGrid`, `PhotoThumb`, `SelectionBar`, `Sonner` |
| ⑥ 사진 크게 보기 | `PhotoViewer`, `Carousel`, `Drawer`(더보기), `AlertDialog`(삭제 요청) |
| 전체 사진 보기 | `PhotoGrid`, `EmptyState` |
| 관리자 로그인 | `AppLogo`, `Input`, `Label`, `Button(default)` |
| 관리자 행사 목록 | `EventCard`, `StatusBadge`, `Progress`, `Button(default)`, `EmptyState` |
| 관리자 행사 만들기 | `Form`, `Input`, `Label`, `Button(default)` |
| 관리자 사진 업로드 | `UploadDropzone`, `UploadProgressPanel`, `UploadFailureList`, `Sonner` |
| 관리자 검수·공개 | `FaceFolderCard`, `SelectionBar`, `AlertDialog`(합치기), `PublishQRDialog` |

---

## 10. 문구 규칙

- 버튼은 동사로 끝나게 짧게: "입장하기", "저장하기", "다시 찍기".
- 오류는 무슨 일이 있었는지 + 무엇을 하면 되는지 한 문장씩: "얼굴이 잘 보이지 않아요. 밝은 곳에서 정면으로 다시 찍어주세요."
- 존댓말 "~해요" 체로 통일합니다.
- "성공적으로", 느낌표, "클릭하세요"는 쓰지 않습니다. 성공은 "저장했어요"처럼 결과만 말합니다.

---

## 11. 출시 전 체크리스트

스킬의 사전 점검 목록에 우리 서비스 항목을 더했습니다.

- [ ] 아이콘에 이모지를 쓰지 않았다 (Lucide만 사용)
- [ ] 눌리는 요소는 모두 44×44px 이상이다
- [ ] 글자 대비 4.5:1 이상 (회색 바탕 위에 `text-muted`를 쓰지 않았다)
- [ ] 키보드 포커스가 모든 버튼·입력칸에서 보인다
- [ ] `prefers-reduced-motion`이 켜지면 움직임이 꺼진다
- [ ] 입력칸 글자가 16px 이상이다 (아이폰 확대 방지)
- [ ] 375px, 768px, 1024px, 1440px에서 가로 스크롤이 없다
- [ ] 아이폰 홈 막대 영역에 버튼이 가려지지 않는다
- [ ] 이미지 자리가 미리 잡혀 있어 로딩 중 화면이 들썩이지 않는다
- [ ] 모든 목록에 로딩·빈 화면·오류 화면이 있다
- [ ] 아이폰 Safari, 안드로이드 Chrome, 카카오톡 인앱 브라우저에서 카메라를 확인했다

---

## 12. 참고한 자료

| 자료 | 무엇을 참고했나 |
|---|---|
| UI UX Pro Max 스킬 `--design-system` | 스타일(Minimalism & Swiss), 인디고+그린 팔레트("student campus community app" 검색 결과), 사전 점검 목록 |
| 같은 스킬 `--domain ux`, `--stack shadcn` | 진행률 표시, 지연 로딩, 토스트 3~5초, 빈 화면, 시트·다이얼로그 포커스 처리 |
| 같은 스킬 `--domain typography` | 한국어 조합으로 Noto Sans KR이 나왔지만, 팀 결정으로 Pretendard 사용 |
| Color Hunt (popular, cold, summer, vintage, sunset 태그) | 팔레트 후보 비교에 사용. 최종으로는 스킬의 D 팔레트를 선택 |

스킬 검색 중 "camera permission" 관련 UX 가이드는 데이터베이스에서 결과가 나오지 않았습니다. `PermissionNotice`는 일반적인 권한 안내 방식을 따랐습니다.
