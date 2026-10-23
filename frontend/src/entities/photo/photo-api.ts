import type { EventPhotoPage } from '@/entities/photo/photo-types'
import { requestApi } from '@/shared/api/client'

/** #7 전체 사진 한 번에 받을 장 수 (서버 기본값과 같게) */
export const eventPhotoPageSize = 30

// #7 전체 사진 보기: 페이지 단위로 받는다(끝까지 내리면 다음 페이지)
export function getEventPhotoPage({
  eventId,
  page,
  size = eventPhotoPageSize,
  signal,
}: {
  eventId: number
  page: number
  size?: number
  signal?: AbortSignal
}): Promise<EventPhotoPage> {
  return requestApi<EventPhotoPage>(`/api/events/${eventId}/photos`, {
    requester: 'participant',
    query: { page, size },
    signal,
  })
}
