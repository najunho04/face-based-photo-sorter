// 환경 변수를 한곳에서 읽어 기본값을 정한다. 실제 값을 담은 .env 파일은 커밋하지 않는다(.env.example 참고).
export const environment = {
  /** 비어 있으면 화면과 같은 주소로 요청한다(배포 때 nginx가 /api를 백엔드로 넘기는 구성) */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  /** 가짜 API는 개발 서버에서만 쓴다. 기본은 켜짐, VITE_USE_MOCK=false면 실제 백엔드로 요청 */
  useMock: import.meta.env.DEV && import.meta.env.VITE_USE_MOCK !== 'false',
} as const
