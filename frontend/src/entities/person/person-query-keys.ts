import { eventQueryKeys } from '@/entities/event/event-query-keys'
import type { PersonRequester } from '@/entities/person/person-api'

// 사람 캐시 열쇠. 관리자·참가자가 같은 탭에서 서로의 캐시를 쓰지 않도록 requester도 열쇠에 넣는다
export const personQueryKeys = {
  /** #10 사람 폴더 목록 */
  list: (eventId: number, minPhotos: number | undefined, requester: PersonRequester) =>
    [...eventQueryKeys.event(eventId), 'persons', { minPhotos, requester }] as const,
  /** #9 사람 폴더 사진 */
  photos: (eventId: number, personId: number, requester: PersonRequester) =>
    [...eventQueryKeys.event(eventId), 'persons', personId, 'photos', { requester }] as const,
}
