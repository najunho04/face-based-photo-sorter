import { infiniteQueryOptions } from '@tanstack/react-query'
import { eventPhotoPageSize, getEventPhotoPage } from '@/entities/photo/photo-api'
import { photoQueryKeys } from '@/entities/photo/photo-query-keys'
import { getImageUrlRefreshMilliseconds } from '@/shared/api/image-url-refresh'

// #7 전체 사진: 페이지를 이어 붙이는 무한 스크롤. 다시 받을 때는 지금까지 본 페이지를 모두 새 주소로 바꾼다
export function eventPhotosInfiniteQueryOptions(eventId: number) {
  return infiniteQueryOptions({
    queryKey: photoQueryKeys.eventPhotos(eventId, eventPhotoPageSize),
    queryFn: ({ pageParam, signal }) => getEventPhotoPage({ eventId, page: pageParam, signal }),
    initialPageParam: 1,
    // 받은 장 수가 전체보다 적으면 다음 페이지가 있다
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.size < lastPage.total ? lastPage.page + 1 : undefined,
    // 주소가 만료되기 전까지는 새것으로 보고, 그 뒤에는 탭으로 돌아올 때·주기적으로 다시 받는다
    staleTime: (query) =>
      getImageUrlRefreshMilliseconds(query.state.data?.pages[0]?.photos[0]?.expiresIn) ?? 0,
    refetchInterval: (query) =>
      getImageUrlRefreshMilliseconds(query.state.data?.pages[0]?.photos[0]?.expiresIn) ?? false,
    refetchOnWindowFocus: true,
  })
}
