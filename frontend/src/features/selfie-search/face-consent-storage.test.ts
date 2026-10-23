import { afterEach, describe, expect, it } from 'vitest'
import {
  hasFaceConsent,
  revokeFaceConsent,
  saveFaceConsent,
} from '@/features/selfie-search/face-consent-storage'

afterEach(() => localStorage.clear())

describe('얼굴 정보 처리 동의 기억', () => {
  it('처음에는 동의하지 않은 상태', () => {
    expect(hasFaceConsent(1)).toBe(false)
  })

  it('동의하면 그 행사에서는 다시 묻지 않는다', () => {
    saveFaceConsent(1)

    expect(hasFaceConsent(1)).toBe(true)
  })

  it('다른 행사에는 따로 동의해야 한다', () => {
    saveFaceConsent(1)

    expect(hasFaceConsent(2)).toBe(false)
  })

  it('동의를 거두면 그 행사만 다시 묻는다(PC에서 체크를 해제한 경우)', () => {
    saveFaceConsent(1)
    saveFaceConsent(2)
    revokeFaceConsent(1)

    expect(hasFaceConsent(1)).toBe(false)
    expect(hasFaceConsent(2)).toBe(true)
  })

  it('기기에 남는 localStorage에 저장한다(결정 기록 2단계)', () => {
    saveFaceConsent(1)

    expect(localStorage.length).toBe(1)
    expect(sessionStorage.length).toBe(0)
  })
})
