/** 백엔드 오류 코드 (docs/api.md 에러코드 표) */
export type ServerErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'LOGIN_FAILED'
  | 'FORBIDDEN'
  | 'INVALID_ACCESS_CODE'
  | 'EVENT_NOT_FOUND'
  | 'PERSON_NOT_FOUND'
  | 'EVENT_NOT_READY'
  | 'INVALID_STATUS'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE'
  | 'FACE_NOT_DETECTED'
  | 'INTERNAL_ERROR'

/** 서버 응답을 받지 못했거나 해석하지 못했을 때 프론트가 붙이는 코드 (서버 표에는 없음) */
export type ClientErrorCode = 'NETWORK_ERROR' | 'TIMEOUT' | 'UNKNOWN_ERROR'

// 서버가 나중에 새 코드를 추가해도 받을 수 있게 string도 허용한다(자동 완성은 위 목록으로 유지)
export type ApiErrorCode = ServerErrorCode | ClientErrorCode | (string & {})

type ApiErrorDetails = {
  code: ApiErrorCode
  /** HTTP 상태. 응답을 받지 못했으면 null */
  status: number | null
  /** 서버가 준 문구. 화면 문구는 코드로 정하고, 모르는 코드일 때만 이 값을 쓴다 */
  serverMessage: string | null
}

// API 호출이 실패하면 항상 이 오류를 던진다. 화면은 status가 아니라 code로 분기한다(LOGIN_FAILED도 401이라서)
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number | null
  readonly serverMessage: string | null

  constructor({ code, status, serverMessage }: ApiErrorDetails) {
    super(
      `${code}${status === null ? '' : ` (${status})`}${serverMessage ? `: ${serverMessage}` : ''}`,
    )
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.serverMessage = serverMessage
  }
}

// 오류가 ApiError이면서 특정 코드인지 확인한다. 화면에서 'catch한 값의 코드' 분기를 짧게 쓰려고 둔다
export function isApiErrorWithCode(error: unknown, code: ApiErrorCode): error is ApiError {
  return error instanceof ApiError && error.code === code
}
