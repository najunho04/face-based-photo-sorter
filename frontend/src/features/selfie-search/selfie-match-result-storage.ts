import type { Person } from '@/entities/person/person-types'
import { readStoredValue, removeStoredValue, writeStoredValue } from '@/shared/lib/stored-value'

// 셀카 검색 결과를 ④ 화면으로 넘기고, 새로고침·뒤로 가기에도 남도록 탭(sessionStorage)에 행사별로 둔다.
// 서버가 준 후보 정보(번호·대표 얼굴 주소·위치)만 저장하고 셀카 사진은 저장하지 않는다

/** ④ 후보 / ④-1 후보 없음 / ④-2 얼굴 못 찾음 */
export type SelfieMatchResult =
  { kind: 'candidates'; candidates: Person[] } | { kind: 'no-match' } | { kind: 'no-face' }

function storageKey(eventId: number): string {
  return `insaengnaecut.selfie-match.${eventId}`
}

// 저장된 값이 결과 모양인지 확인한다(후보는 사람 번호·대표 얼굴이 있는지까지)
function isSelfieMatchResult(value: unknown): value is SelfieMatchResult {
  const candidate = value as Partial<{ kind: string; candidates: unknown }> | null
  if (typeof candidate !== 'object' || candidate === null) return false
  if (candidate.kind === 'no-match' || candidate.kind === 'no-face') return true
  return (
    candidate.kind === 'candidates' &&
    Array.isArray(candidate.candidates) &&
    candidate.candidates.every(
      (person: Partial<Person>) =>
        typeof person.personId === 'number' && typeof person.repFace?.url === 'string',
    )
  )
}

export function saveSelfieMatchResult(eventId: number, result: SelfieMatchResult): void {
  writeStoredValue('session', storageKey(eventId), result)
}

export function readSelfieMatchResult(eventId: number): SelfieMatchResult | null {
  return readStoredValue('session', storageKey(eventId), isSelfieMatchResult)
}

export function clearSelfieMatchResult(eventId: number): void {
  removeStoredValue('session', storageKey(eventId))
}
