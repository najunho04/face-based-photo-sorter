// 팀 규칙상 .env.example만 저장소에 올리므로, 환경 변수가 없을 때의 기본값을 여기서 정한다.
const useMockSetting = import.meta.env.VITE_USE_MOCK

export const environment = {
  // 비어 있으면 같은 주소의 /api/... 로 요청한다 (배포 시 nginx가 /api를 백엔드로 넘기는 구조)
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  // 설정이 없으면 개발 서버(npm run dev)에서는 가짜 API, 빌드 결과에서는 실제 API를 쓴다
  useMock:
    useMockSetting === undefined || useMockSetting === ''
      ? import.meta.env.DEV
      : useMockSetting === 'true',
} as const
