import { readStoredValue, writeStoredValue } from '@/shared/lib/stored-value'

// '내 폴더' 기억: ②-2 내 사진 바로가기에 쓸 사람 번호를 행사별로 기기(localStorage)에 남긴다.
// 결정: 탭을 닫았다가 QR로 다시 들어와도 남도록 localStorage. 사람 번호만 저장하고 사진·얼굴은 저장하지 않는다.

const myPersonStorageKey = 'insaengnaecut.my-persons'

/** 행사 번호(문자열) → 내 사람 번호 목록 */
type MyPersonsByEvent = Record<string, number[]>

// 저장된 값이 '행사 번호 → 숫자 배열' 모양인지 확인한다
function isMyPersonsByEvent(value: unknown): value is MyPersonsByEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every(
      (personIds) => Array.isArray(personIds) && personIds.every((id) => typeof id === 'number'),
    )
  )
}

function readAll(): MyPersonsByEvent {
  return readStoredValue('local', myPersonStorageKey, isMyPersonsByEvent) ?? {}
}

export function readMyPersonIds(eventId: number): number[] {
  return readAll()[eventId] ?? []
}

/** 목록을 바꾼다(④ 후보에서 고를 때: 셀카로 새로 찾은 결과로 바꿈) */
export function saveMyPersonIds(eventId: number, personIds: number[]): void {
  writeStoredValue('local', myPersonStorageKey, {
    ...readAll(),
    [eventId]: [...new Set(personIds)],
  })
}

/** 목록에 더한다(⑤에서 [이게 나예요]: 이미 기억한 폴더는 그대로 둠) */
export function addMyPersonIds(eventId: number, personIds: number[]): void {
  saveMyPersonIds(eventId, [...readMyPersonIds(eventId), ...personIds])
}

/** 그 행사의 내 폴더 기억을 지운다 */
export function forgetMyPersonIds(eventId: number): void {
  const { [eventId]: _forgotten, ...remaining } = readAll()
  writeStoredValue('local', myPersonStorageKey, remaining)
}
