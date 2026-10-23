import { eventQueryKeys } from '@/entities/event/event-query-keys'

// 사진 캐시 열쇠. 행사 열쇠 아래에 두어 행사 단위로 함께 무효화된다
export const photoQueryKeys = {
  /** #7 전체 사진(페이지를 이어 붙이는 무한 스크롤) */
  eventPhotos: (eventId: number, pageSize: number) =>
    [...eventQueryKeys.event(eventId), 'photos', { pageSize }] as const,
}
