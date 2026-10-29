# 인생내컷 프론트엔드

셀카 한 장으로 행사 사진 속 내 사진만 골라 받는 웹서비스의 프론트엔드입니다.

## 실행

```bash
npm install
npm run dev
```

| 명령              | 하는 일                           |
| ----------------- | --------------------------------- |
| `npm run dev`     | 개발 서버 (기본: 가짜 API 사용)   |
| `npm run build`   | 타입 검사 + 배포용 빌드 (`dist/`) |
| `npm run preview` | 빌드 결과를 배포처럼 띄워 확인    |
| `npm run lint`    | oxlint 검사                       |
| `npm test`        | 로직 테스트 (Vitest)              |
| `npm run format`  | Prettier로 코드 정리              |

## 환경 변수

아무것도 설정하지 않으면 `npm run dev`는 가짜 API(MSW)로 동작합니다. 저장소에는 `.env.example`만 올리고,
실제 백엔드에 붙일 때는 `.env.example`을 `.env.development.local`로 복사해서 씁니다(저장소 제외).

| 이름                | 설명                                                                                |
| ------------------- | ----------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | 백엔드 주소. 로컬 백엔드는 `http://localhost:8000`, 비워두면 같은 주소의 `/api/...` |
| `VITE_USE_MOCK`     | `false`면 개발 서버도 실제 백엔드 사용. 비워두면 개발 서버는 가짜 API               |

기본값은 `src/shared/config/environment.ts`에 있습니다. 빌드 결과(`npm run build`)는 설정과 상관없이 항상 실제 API를 씁니다.

## 가짜 API (개발 서버)

`src/mocks/`의 MSW 핸들러가 백엔드 명세(`docs/api.md`) 10개 API를 흉내 냅니다.

- 화면 왼쪽 아래 **가짜 API** 버튼: 셀카 검색 결과(후보 3·1·0명, 얼굴 없음), 응답 속도, 다음 요청 한 번 실패(서버 오류·네트워크 끊김·시간 초과), 이미지 주소 60초 만료, 토큰 만료, 데이터 초기화
- 관리자 테스트 계정과 샘플 행사 인증코드: `src/mocks/mock-accounts.ts` (패널에도 표시)
- 사진은 실제 인물 대신 코드로 그린 일러스트 JPG이고, 얼굴 위치(bbox)가 그림과 맞습니다.
- 관리자가 만든 행사·업로드 기록은 브라우저 localStorage에 남습니다. 업로드를 완료하면 시간이 흐르며 얼굴 찾기 → 묶기 → 공개로 바뀝니다.

## 문서

- 개발 계획: [`docs/frontend-dev-plan.md`](docs/frontend-dev-plan.md)
- 디자인 명세서: [`docs/design-system/insaengnaecut/MASTER.md`](docs/design-system/insaengnaecut/MASTER.md)

## 폴더 구조

```
src/
  app/       라우터, Provider, 레이아웃, 가드
  pages/     화면 (participant/, admin/)
  features/  카메라, 셀카 검색, 사진 선택·저장, 업로드, 공개(QR)
  entities/  행사·사진·사람 타입과 API
  shared/    공통 UI, API 클라이언트, 유틸, 스타일, 설정
  mocks/     MSW 가짜 API
```

import는 위에서 아래로만 합니다 (app → pages → features → entities → shared).
