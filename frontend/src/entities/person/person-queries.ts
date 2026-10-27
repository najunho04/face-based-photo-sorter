import { queryOptions } from '@tanstack/react-query'
import { getPersonPhotos, getPersons, type PersonRequester } from '@/entities/person/person-api'
import { personQueryKeys } from '@/entities/person/person-query-keys'
import { getImageUrlRefreshMilliseconds } from '@/shared/api/image-url-refresh'

// 사람 목록·사람 사진을 TanStack Query로 받을 때의 설정. 화면마다 같은 열쇠·같은 새로고침 규칙을 쓰려고 모았다.

/**
 * #8·#10의 대표 얼굴 주소에는 만료 시간(expiresIn)이 없어 백엔드 기본값(docs/api.md 3600초)으로 본다.
 * 실제로 더 빨리 만료되면 이미지가 깨질 때 다시 받는 처리(useRefetchOnImageError)가 막아 준다
 */
const assumedRepresentativeFaceExpiresInSeconds = 3600

// #10 사람 폴더 목록
export function personListQueryOptions({
  eventId,
  minPhotos,
  requester,
}: {
  eventId: number
  minPhotos?: number
  requester: PersonRequester
}) {
  return queryOptions({
    queryKey: personQueryKeys.list(eventId, minPhotos, requester),
    queryFn: ({ signal }) => getPersons({ eventId, minPhotos, requester, signal }),
    // 주소가 만료되기 전까지는 새것으로 보고, 그 뒤에는 탭으로 돌아올 때·주기적으로 다시 받는다
    // (탭을 오갈 때마다 다시 받으면 사진을 매번 새로 내려받으므로 만료 전에는 다시 받지 않는다)
    staleTime: getImageUrlRefreshMilliseconds(assumedRepresentativeFaceExpiresInSeconds) ?? 0,
    refetchInterval: () =>
      getImageUrlRefreshMilliseconds(assumedRepresentativeFaceExpiresInSeconds) ?? false,
    refetchOnWindowFocus: true,
  })
}

// #9 사람 폴더 사진. 응답의 expiresIn으로 만료 전에 다시 받는다
export function personPhotosQueryOptions({
  eventId,
  personId,
  requester,
}: {
  eventId: number
  personId: number
  requester: PersonRequester
}) {
  return queryOptions({
    queryKey: personQueryKeys.photos(eventId, personId, requester),
    queryFn: ({ signal }) => getPersonPhotos({ eventId, personId, requester, signal }),
    staleTime: (query) =>
      getImageUrlRefreshMilliseconds(query.state.data?.photos[0]?.expiresIn) ?? 0,
    refetchInterval: (query) =>
      getImageUrlRefreshMilliseconds(query.state.data?.photos[0]?.expiresIn) ?? false,
    refetchOnWindowFocus: true,
  })
}
