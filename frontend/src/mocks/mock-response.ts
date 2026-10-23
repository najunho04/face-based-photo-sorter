import { delay, HttpResponse } from 'msw'
import type { ServerErrorCode } from '@/shared/api/api-error'
import { getMockSettings, takeNextRequestFailure } from '@/mocks/mock-settings'
import { readMockToken, type MockTokenPayload } from '@/mocks/mock-tokens'

// 가짜 API 응답을 docs/api.md 공통 형식으로 만드는 도구와, 오류 재현 패널 설정을 적용하는 도구.

// 오류 코드별 HTTP 상태 (docs/api.md 에러코드 표)
const errorStatuses: Record<ServerErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  LOGIN_FAILED: 401,
  FORBIDDEN: 403,
  INVALID_ACCESS_CODE: 404,
  EVENT_NOT_FOUND: 404,
  PERSON_NOT_FOUND: 404,
  EVENT_NOT_READY: 409,
  INVALID_STATUS: 409,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE: 415,
  FACE_NOT_DETECTED: 422,
  INTERNAL_ERROR: 500,
}

// 서버가 보낼 법한 문구. 화면은 코드로 문구를 정하므로 여기 문구는 서버 흉내일 뿐이다
const serverMessages: Record<ServerErrorCode, string> = {
  INVALID_REQUEST: '요청 형식이 올바르지 않습니다.',
  UNAUTHORIZED: '인증이 필요합니다.',
  LOGIN_FAILED: '아이디 또는 비밀번호가 일치하지 않습니다.',
  FORBIDDEN: '접근 권한이 없습니다.',
  INVALID_ACCESS_CODE: '존재하지 않는 인증코드입니다.',
  EVENT_NOT_FOUND: '행사를 찾을 수 없습니다.',
  PERSON_NOT_FOUND: '사람 폴더를 찾을 수 없습니다.',
  EVENT_NOT_READY: '아직 분류 중입니다.',
  INVALID_STATUS: '현재 상태에서 처리할 수 없습니다.',
  FILE_TOO_LARGE: '파일 용량이 너무 큽니다.',
  UNSUPPORTED_FILE: '지원하지 않는 파일 형식입니다.',
  FACE_NOT_DETECTED: '얼굴을 찾지 못했습니다.',
  INTERNAL_ERROR: '서버 내부 오류가 발생했습니다.',
}

export function successResponse(data: unknown) {
  return HttpResponse.json({ success: true, data, error: null })
}

export function failureResponse(code: ServerErrorCode) {
  return HttpResponse.json(
    { success: false, data: null, error: { code, message: serverMessages[code] } },
    { status: errorStatuses[code] },
  )
}

/**
 * 모든 API 핸들러가 먼저 부른다. 패널의 '다음 요청 한 번 실패'와 응답 속도를 적용한다.
 * 실패시킬 때는 그 응답을, 아니면 null을 돌려준다
 */
export async function applyServerConditions(): Promise<Response | null> {
  const failure = takeNextRequestFailure()
  if (failure === 'network-error') return HttpResponse.error()
  if (failure === 'server-error') return failureResponse('INTERNAL_ERROR')
  // 시간 초과: 응답하지 않고 계속 기다리게 해서 프론트의 대기 시간 제한이 걸리게 한다
  if (failure === 'timeout') await delay('infinite')

  if (getMockSettings().responseSpeed === 'slow') await delay(2000 + Math.random() * 1000)
  else await delay()
  return null
}

type AuthorizationResult =
  { tokenPayload: MockTokenPayload; failure: null } | { tokenPayload: null; failure: Response }

/**
 * 토큰을 확인한다. 순서: 토큰 없음·만료 → 401, 허용하지 않는 역할 → 403,
 * 참가자 토큰의 행사와 주소의 행사가 다름 → 403 (docs/api.md 인증)
 */
export function authorizeRequest(
  request: Request,
  allowedRoles: ReadonlyArray<MockTokenPayload['role']>,
  pathEventId?: number,
): AuthorizationResult {
  const tokenPayload = readMockToken(request)
  const isExpired =
    tokenPayload === null ||
    tokenPayload.expiresAt <= Date.now() ||
    tokenPayload.issuedAt < getMockSettings().tokensInvalidBefore
  if (isExpired) return { tokenPayload: null, failure: failureResponse('UNAUTHORIZED') }
  if (!allowedRoles.includes(tokenPayload.role)) {
    return { tokenPayload: null, failure: failureResponse('FORBIDDEN') }
  }
  if (
    tokenPayload.role === 'participant' &&
    pathEventId !== undefined &&
    tokenPayload.eventId !== pathEventId
  ) {
    return { tokenPayload: null, failure: failureResponse('FORBIDDEN') }
  }
  return { tokenPayload, failure: null }
}

// JSON 본문을 읽는다. 형식이 깨졌으면 null(핸들러가 INVALID_REQUEST로 답함)
export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// multipart 본문에서 파일 항목만 꺼낸다. 문자열 항목은 뺀다
export async function readFormFiles(request: Request, fieldName: string): Promise<File[]> {
  try {
    const formData = await request.formData()
    return formData.getAll(fieldName).filter((value): value is File => typeof value !== 'string')
  } catch {
    return []
  }
}

/** 업로드·셀카에 허용하는 이미지 형식 (docs/api.md: jpg·png 외 UNSUPPORTED_FILE) */
export const supportedImageTypes = ['image/jpeg', 'image/png']
