import { readStoredValue, writeStoredValue } from '@/shared/lib/stored-value'

// 얼굴 정보 처리 동의를 행사별로 기기(localStorage)에 기억한다. 한 번 동의하면 그 행사에서는 다시 묻지 않는다(결정 기록 2·5단계)

const faceConsentStorageKey = 'insaengnaecut.face-consents'

/** 동의한 행사 번호 목록인지 확인한다 */
function isEventIdList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((eventId) => typeof eventId === 'number')
}

function readConsentedEventIds(): number[] {
  return readStoredValue('local', faceConsentStorageKey, isEventIdList) ?? []
}

export function hasFaceConsent(eventId: number): boolean {
  return readConsentedEventIds().includes(eventId)
}

export function saveFaceConsent(eventId: number): void {
  writeStoredValue('local', faceConsentStorageKey, [
    ...new Set([...readConsentedEventIds(), eventId]),
  ])
}
