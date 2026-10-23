import type { EventStatus } from '@/entities/event/event-status'
import { requestApi } from '@/shared/api/client'

// 로그인·입장 API (docs/api.md #1, #6). 토큰이 없을 때 부르므로 익명 요청이다.

/** #1 관리자 로그인 응답. expiresIn은 초 단위 */
export type AdministratorLogin = { accessToken: string; expiresIn: number }

/** #6 참가자 입장 응답. status가 open이 아니면 '사진 정리 중' 화면을 보여 준다 */
export type EventJoin = {
  accessToken: string
  eventId: number
  eventName: string
  status: EventStatus
}

// #1 관리자 로그인
export function loginAdministrator({
  loginId,
  password,
}: {
  loginId: string
  password: string
}): Promise<AdministratorLogin> {
  return requestApi<AdministratorLogin>('/api/admin/login', {
    method: 'POST',
    requester: 'anonymous',
    jsonBody: { loginId, password },
  })
}

// #6 참가자 입장: QR 값이나 직접 입력한 인증코드로 참가자 토큰을 받는다
export function joinEvent(accessCode: string): Promise<EventJoin> {
  return requestApi<EventJoin>('/api/events/join', {
    method: 'POST',
    requester: 'anonymous',
    jsonBody: { accessCode },
  })
}
