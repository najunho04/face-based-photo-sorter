/// <reference types="msw/vite/client" />

// Vite가 주입하는 환경 변수 타입. 값이 없을 수 있어서 모두 선택 항목으로 둔다.
interface ImportMetaEnv {
  /** 백엔드 API 주소. 비어 있으면 같은 주소의 /api/... 로 요청한다 */
  readonly VITE_API_BASE_URL?: string
  /** 개발 서버에서 MSW 가짜 API를 쓸지. 'false'면 끈다. 빌드에서는 항상 실제 API */
  readonly VITE_USE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
