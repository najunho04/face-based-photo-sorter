import { readStoredValue, writeStoredValue } from '@/shared/lib/stored-value'

// A2 최근 행사: 관리자 행사 목록 API가 없어서, 이 브라우저에서 만든 행사 번호를 기기(localStorage)에 남긴다
const recentEventStorageKey = 'insaengnaecut.recent-events'

function isEventIdList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((eventId) => typeof eventId === 'number')
}

/** 최근에 만든(연) 행사가 앞에 오는 행사 번호 목록 */
export function readRecentEventIds(): number[] {
  return readStoredValue('local', recentEventStorageKey, isEventIdList) ?? []
}

// 행사를 맨 앞에 넣는다(이미 있으면 맨 앞으로 옮긴다)
export function addRecentEvent(eventId: number): void {
  writeStoredValue('local', recentEventStorageKey, [
    eventId,
    ...readRecentEventIds().filter((recentEventId) => recentEventId !== eventId),
  ])
}

// 목록에서 지운다(행사가 없어졌을 때)
export function removeRecentEvent(eventId: number): void {
  writeStoredValue(
    'local',
    recentEventStorageKey,
    readRecentEventIds().filter((recentEventId) => recentEventId !== eventId),
  )
}
