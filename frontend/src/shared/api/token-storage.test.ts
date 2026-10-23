import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllSessions,
  clearParticipantSession,
  readAdministratorSession,
  readParticipantSession,
  saveAdministratorSession,
  saveParticipantSession,
} from '@/shared/api/token-storage'

afterEach(() => {
  clearAllSessions()
  vi.useRealTimers()
})

describe('관리자 세션', () => {
  it('저장한 토큰을 다시 읽는다', () => {
    saveAdministratorSession({ accessToken: 'administrator-token', expiresInSeconds: 3600 })

    expect(readAdministratorSession()?.accessToken).toBe('administrator-token')
  })

  it('만료 시간이 지나면 없는 것으로 보고 지운다', () => {
    vi.useFakeTimers({ now: new Date('2026-10-23T10:00:00Z') })
    saveAdministratorSession({ accessToken: 'administrator-token', expiresInSeconds: 3600 })

    vi.setSystemTime(new Date('2026-10-23T11:00:01Z'))

    expect(readAdministratorSession()).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it('sessionStorage에 저장한다(탭을 닫으면 사라짐)', () => {
    saveAdministratorSession({ accessToken: 'administrator-token', expiresInSeconds: 3600 })

    expect(sessionStorage.length).toBe(1)
    expect(localStorage.length).toBe(0)
  })
})

describe('참가자 세션', () => {
  const participantSession = {
    accessToken: 'participant-token',
    eventId: 1,
    eventName: '2026 가을 축제',
    accessCode: 'A7K2Q9',
  }

  it('토큰과 행사 정보를 함께 저장하고 읽는다', () => {
    saveParticipantSession(participantSession)

    expect(readParticipantSession()).toEqual(participantSession)
  })

  it('지우면 없는 것으로 읽힌다', () => {
    saveParticipantSession(participantSession)
    clearParticipantSession()

    expect(readParticipantSession()).toBeNull()
  })

  it('저장된 값이 깨져 있으면 없는 것으로 본다', () => {
    saveParticipantSession(participantSession)
    const storedKey = sessionStorage.key(0)!
    sessionStorage.setItem(storedKey, '{깨진 값')

    expect(readParticipantSession()).toBeNull()
  })

  it('저장된 값의 모양이 다르면 없는 것으로 본다', () => {
    saveParticipantSession(participantSession)
    const storedKey = sessionStorage.key(0)!
    sessionStorage.setItem(storedKey, JSON.stringify({ accessToken: 'only-token' }))

    expect(readParticipantSession()).toBeNull()
  })
})
