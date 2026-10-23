import { readStoredValue, removeStoredValue, writeStoredValue } from '@/shared/lib/stored-value'

// 로그인·입장 토큰 저장소. 명세대로 sessionStorage에 두어 탭을 닫으면 사라지게 한다(공용 기기 대비).

const administratorSessionKey = 'insaengnaecut.administrator-session'
const participantSessionKey = 'insaengnaecut.participant-session'

/** 관리자 로그인 정보. expiresAt은 만료 시각(밀리초), loginId는 왼쪽 메뉴 아래에 보여 줄 아이디 */
export type AdministratorSession = { accessToken: string; expiresAt: number; loginId: string }

/** 참가자 입장 정보. 화면 제목과 다시 입장할 때 쓰도록 행사 이름·인증코드도 함께 둔다 */
export type ParticipantSession = {
  accessToken: string
  eventId: number
  eventName: string
  accessCode: string
  /** 입장할 때 행사가 공개(open) 상태였는지. 공개 전이면 가드가 '사진 정리 중' 화면으로 보낸다 */
  isEventOpen: boolean
}

// 저장된 값이 관리자 세션 모양인지 확인한다
function isAdministratorSession(value: unknown): value is AdministratorSession {
  const candidate = value as Partial<AdministratorSession> | null
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.accessToken === 'string' &&
    typeof candidate.expiresAt === 'number' &&
    typeof candidate.loginId === 'string'
  )
}

// 저장된 값이 참가자 세션 모양인지 확인한다
function isParticipantSession(value: unknown): value is ParticipantSession {
  const candidate = value as Partial<ParticipantSession> | null
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.accessToken === 'string' &&
    typeof candidate.eventId === 'number' &&
    typeof candidate.eventName === 'string' &&
    typeof candidate.accessCode === 'string' &&
    typeof candidate.isEventOpen === 'boolean'
  )
}

// 로그인 응답의 expiresIn(초)을 만료 시각으로 바꿔 저장한다. 만료된 토큰으로 요청하지 않으려고 시각을 기억한다
export function saveAdministratorSession({
  accessToken,
  expiresInSeconds,
  loginId,
}: {
  accessToken: string
  expiresInSeconds: number
  loginId: string
}): void {
  const session: AdministratorSession = {
    accessToken,
    expiresAt: Date.now() + expiresInSeconds * 1000,
    loginId,
  }
  writeStoredValue('session', administratorSessionKey, session)
}

// 관리자 세션을 읽는다. 만료 시각이 지났으면 지우고 null
export function readAdministratorSession(): AdministratorSession | null {
  const session = readStoredValue('session', administratorSessionKey, isAdministratorSession)
  if (session && Date.now() >= session.expiresAt) {
    clearAdministratorSession()
    return null
  }
  return session
}

export function clearAdministratorSession(): void {
  removeStoredValue('session', administratorSessionKey)
}

// 참가자 세션을 저장한다. 입장 응답에는 만료 시간이 없어(docs/api.md #6) 401을 받으면 그때 만료로 처리한다
export function saveParticipantSession(session: ParticipantSession): void {
  writeStoredValue('session', participantSessionKey, session)
}

export function readParticipantSession(): ParticipantSession | null {
  return readStoredValue('session', participantSessionKey, isParticipantSession)
}

export function clearParticipantSession(): void {
  removeStoredValue('session', participantSessionKey)
}

// 관리자·참가자 세션을 모두 지운다(테스트 정리, 가짜 API 초기화에 사용)
export function clearAllSessions(): void {
  clearAdministratorSession()
  clearParticipantSession()
}
