interface ImportMetaEnv {
  /** API 기본 주소. 비어 있으면 같은 주소(/api/...)로 요청 */
  readonly VITE_API_BASE_URL: string
  /** 'true'면 MSW 가짜 API 사용 */
  readonly VITE_USE_MOCK: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
