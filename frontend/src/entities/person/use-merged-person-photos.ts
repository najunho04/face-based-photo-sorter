import { useQueries } from '@tanstack/react-query'
import { mergePersonPhotos } from '@/entities/person/merge-person-photos'
import { personPhotosQueryOptions } from '@/entities/person/person-queries'
import { isApiErrorWithCode } from '@/shared/api/api-error'

// 여러 사람 폴더(#9)를 받아 하나로 합친다(⑤ 합쳐 보기, ⑥ 크게 보기, ②-2가 같은 캐시를 쓴다).
// 없어진 폴더(PERSON_NOT_FOUND)는 빼고, 나머지 폴더 사진만 보여 준다
export function useMergedPersonPhotos(eventId: number, personIds: number[]) {
  const photoQueries = useQueries({
    queries: personIds.map((personId) =>
      personPhotosQueryOptions({ eventId, personId, requester: 'participant' }),
    ),
  })

  const missingPersonIds = personIds.filter((_, index) =>
    isApiErrorWithCode(photoQueries[index]?.error, 'PERSON_NOT_FOUND'),
  )
  const failedQuery = photoQueries.find(
    (photoQuery) => photoQuery.isError && !isApiErrorWithCode(photoQuery.error, 'PERSON_NOT_FOUND'),
  )
  const loadedFolders = photoQueries.flatMap((photoQuery) =>
    photoQuery.data ? [photoQuery.data] : [],
  )

  return {
    photos: mergePersonPhotos(loadedFolders.map((folder) => folder.photos)),
    /** 폴더별 서버 이름(label). "사람 3" 표시에 쓴다 */
    labels: loadedFolders.map((folder) => folder.label),
    folderCount: loadedFolders.length,
    missingPersonIds,
    isPending: photoQueries.some((photoQuery) => photoQuery.isPending),
    error: failedQuery?.error ?? null,
    /** 모든 폴더를 다시 받는다(만료된 사진 주소 새로고침·다시 시도) */
    refetch: () => photoQueries.forEach((photoQuery) => void photoQuery.refetch()),
  }
}
