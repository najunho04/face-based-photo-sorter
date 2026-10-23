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
| `npm run format`  | Prettier로 코드 정리              |

## 환경 변수

`.env.example` 참고. 내 컴퓨터 전용 설정은 `.env.development.local`에 적습니다(저장소 제외).

| 이름                | 설명                                                  |
| ------------------- | ----------------------------------------------------- |
| `VITE_API_BASE_URL` | API 기본 주소. 비워두면 같은 주소의 `/api/...`로 요청 |
| `VITE_USE_MOCK`     | `true`면 MSW 가짜 API 사용                            |

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
