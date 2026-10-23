import { environment } from '@/shared/config/environment'
import { ApiError } from '@/shared/api/api-error'
import { readAdministratorSession, readParticipantSession } from '@/shared/api/token-storage'

/** 누가 보내는 요청인지. 붙일 토큰과 401 때 돌아갈 화면이 달라진다 */
export type Requester = 'administrator' | 'participant' | 'anonymous'

type RequestOptions = {
  method?: 'GET' | 'POST'
  requester: Requester
  /** 주소 뒤에 붙일 값. undefined인 항목은 뺀다 */
  query?: Record<string, string | number | undefined>
  /** JSON으로 보낼 본문 */
  jsonBody?: unknown
  /** 파일 업로드 본문. Content-Type은 브라우저가 경계값과 함께 정하도록 비워 둔다 */
  formData?: FormData
  /** 응답을 기다리는 최대 시간. 셀카 검색·업로드처럼 오래 걸리는 요청은 늘려서 넘긴다 */
  timeoutMilliseconds?: number
  /** 화면을 떠나면 요청을 취소하려고 TanStack Query가 넘겨주는 신호 */
  signal?: AbortSignal
}

/** 기본 응답 대기 시간 */
export const defaultTimeoutMilliseconds = 15_000

/** 백엔드 공통 응답 형식 (docs/api.md 응답 형식) */
type ApiEnvelope =
  | { success: true; data: unknown; error: null }
  | { success: false; data: null; error: { code: string; message: string } }

type UnauthorizedListener = (requester: Exclude<Requester, 'anonymous'>) => void

// 401을 받았을 때 화면을 옮기는 일은 앱(라우터)이 맡는다. 클라이언트는 알리기만 한다
let unauthorizedListener: UnauthorizedListener | null = null

/** UNAUTHORIZED 응답을 받으면 부를 함수를 등록한다. 돌려받은 함수를 부르면 등록을 해제한다 */
export function setUnauthorizedListener(listener: UnauthorizedListener): () => void {
  unauthorizedListener = listener
  return () => {
    if (unauthorizedListener === listener) unauthorizedListener = null
  }
}

// 백엔드에 요청을 보내고, 성공하면 공통 응답의 data만 돌려준다. 실패는 모두 ApiError로 바꿔 던진다(호출 취소만 예외)
export async function requestApi<ResponseData>(
  path: string,
  {
    method = 'GET',
    requester,
    query,
    jsonBody,
    formData,
    timeoutMilliseconds = defaultTimeoutMilliseconds,
    signal,
  }: RequestOptions,
): Promise<ResponseData> {
  const headers = new Headers({ Accept: 'application/json' })
  const accessToken = getAccessToken(requester)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  if (jsonBody !== undefined) headers.set('Content-Type', 'application/json')

  // 시간 초과와 호출한 쪽의 취소를 하나의 신호로 합친다. 어느 쪽 때문에 멈췄는지는 timedOut으로 구분한다
  const abortController = new AbortController()
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    abortController.abort()
  }, timeoutMilliseconds)
  const abortFromCaller = () => abortController.abort(signal?.reason)
  if (signal?.aborted) abortFromCaller()
  signal?.addEventListener('abort', abortFromCaller, { once: true })

  try {
    let response: Response
    try {
      response = await fetch(buildRequestUrl(path, query), {
        method,
        headers,
        body: formData ?? (jsonBody === undefined ? undefined : JSON.stringify(jsonBody)),
        signal: abortController.signal,
      })
    } catch (fetchError) {
      if (timedOut) throw new ApiError({ code: 'TIMEOUT', status: null, serverMessage: null })
      // 호출한 쪽이 취소했으면 그대로 던진다(TanStack Query가 취소로 처리하도록)
      if (signal?.aborted) throw fetchError
      throw new ApiError({ code: 'NETWORK_ERROR', status: null, serverMessage: null })
    }

    const envelope = await readEnvelope(response)
    if (envelope?.success === true) return envelope.data as ResponseData

    const apiError = convertToApiError(response.status, envelope)
    if (apiError.code === 'UNAUTHORIZED' && requester !== 'anonymous') {
      unauthorizedListener?.(requester)
    }
    throw apiError
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}

// 요청한 사람에 맞는 토큰을 꺼낸다. 로그인·입장처럼 익명 요청에는 붙이지 않는다
function getAccessToken(requester: Requester): string | null {
  if (requester === 'administrator') return readAdministratorSession()?.accessToken ?? null
  if (requester === 'participant') return readParticipantSession()?.accessToken ?? null
  return null
}

// 기본 주소 + 경로 + 쿼리로 전체 주소를 만든다. 기본 주소가 비어 있으면 지금 화면과 같은 주소를 쓴다
function buildRequestUrl(path: string, query: RequestOptions['query']): string {
  const requestUrl = new URL(path, environment.apiBaseUrl || window.location.origin)
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined) requestUrl.searchParams.set(name, String(value))
  }
  return requestUrl.toString()
}

// 응답 본문이 공통 응답 형식이면 꺼내고, 아니면(HTML 오류 페이지, 빈 본문 등) null
async function readEnvelope(response: Response): Promise<ApiEnvelope | null> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null && 'success' in body) {
      return body as ApiEnvelope
    }
    return null
  } catch {
    return null
  }
}

// 실패 응답을 ApiError로 바꾼다. 공통 형식이 아니면(앞단 서버가 막은 경우 등) HTTP 상태로 코드를 짐작한다
function convertToApiError(status: number, envelope: ApiEnvelope | null): ApiError {
  if (envelope?.success === false && envelope.error) {
    return new ApiError({
      code: envelope.error.code,
      status,
      serverMessage: envelope.error.message ?? null,
    })
  }
  return new ApiError({ code: guessCodeFromStatus(status), status, serverMessage: null })
}

// 공통 형식이 없는 응답의 HTTP 상태를 오류 코드로 바꾼다
function guessCodeFromStatus(status: number): string {
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 413) return 'FILE_TOO_LARGE'
  if (status === 415) return 'UNSUPPORTED_FILE'
  if (status >= 500) return 'INTERNAL_ERROR'
  return 'UNKNOWN_ERROR'
}
