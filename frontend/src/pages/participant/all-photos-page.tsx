import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronLeftIcon, ImageOffIcon } from 'lucide-react'
import { Link } from 'react-router'
import { PhotoGrid, PhotoThumbnail } from '@/entities/photo/photo-grid'
import { eventPhotosInfiniteQueryOptions } from '@/entities/photo/photo-queries'
import { viewerSourceToQuery } from '@/entities/photo/viewer-source'
import { useCurrentParticipantSession } from '@/entities/session/participant-session'
import { useEventNotReadyRedirect } from '@/pages/participant/use-event-not-ready-redirect'
import { getErrorMessage } from '@/shared/api/error-messages'
import { paths } from '@/shared/config/paths'
import { useLoadMoreTrigger } from '@/shared/lib/use-load-more-trigger'
import { useRefetchOnImageError } from '@/shared/lib/use-refetch-on-image-error'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { ErrorState } from '@/shared/ui/error-state'
import { PhotoPlaceholder } from '@/shared/ui/photo-placeholder'

// ⑦ 전체 사진: 행사 사진 전체를 30장씩 받아 끝까지 내리면 다음 페이지를 이어 붙인다(#7).
// 사진을 누르면 ⑥ 크게 보기로 간다
export default function AllPhotosPage() {
  const session = useCurrentParticipantSession()
  const photosQuery = useInfiniteQuery(eventPhotosInfiniteQueryOptions(session.eventId))
  useEventNotReadyRedirect(photosQuery.error, session)
  const refetchOnImageError = useRefetchOnImageError(photosQuery.refetch)
  const loadMoreTriggerRef = useLoadMoreTrigger(
    () => void photosQuery.fetchNextPage(),
    photosQuery.hasNextPage && !photosQuery.isFetchingNextPage && !photosQuery.isFetchNextPageError,
  )

  const photos = photosQuery.data?.pages.flatMap((page) => page.photos) ?? []
  const totalPhotoCount = photosQuery.data?.pages[0]?.total

  return (
    <div className="flex flex-col pb-[calc(env(safe-area-inset-bottom)+32px)] lg:px-6 lg:pb-12">
      {/* 휴대폰: 뒤로 + 제목 / PC: '← 사람별 사진' 링크 + 큰 제목 */}
      <div className="px-2.5 pt-[calc(env(safe-area-inset-top)+8px)] lg:hidden">
        <Button asChild variant="ghost" size="icon" aria-label="사람별 사진으로">
          <Link to={paths.eventHome(session.accessCode)}>
            <ChevronLeftIcon className="size-6" />
          </Link>
        </Button>
      </div>
      <Link
        to={paths.eventHome(session.accessCode)}
        className="touch-target hidden items-center self-start text-small font-semibold text-muted-foreground lg:mt-7 lg:flex"
      >
        ← 사람별 사진
      </Link>
      <div className="flex flex-col gap-0.5 px-5 pb-4 lg:px-0 lg:pt-5 lg:pb-5">
        <h1 className="text-[22px] leading-8 font-bold lg:text-display">전체 사진</h1>
        <p className="text-[13px] leading-5 text-muted-foreground lg:text-small">
          {session.eventName}
          {totalPhotoCount !== undefined && ` · 사진 ${totalPhotoCount}장`}
        </p>
      </div>

      {photosQuery.isPending ? (
        <PhotoGrid>
          {Array.from({ length: 21 }, (_, index) => (
            <PhotoPlaceholder key={index} className="lg:aspect-[4/3]" />
          ))}
        </PhotoGrid>
      ) : photosQuery.isError && photos.length === 0 ? (
        <ErrorState
          title="사진을 불러오지 못했어요"
          description={getErrorMessage(photosQuery.error)}
          onRetry={() => void photosQuery.refetch()}
        />
      ) : photos.length === 0 ? (
        <EmptyState icon={ImageOffIcon} title="아직 올라온 사진이 없어요" />
      ) : (
        <>
          <PhotoGrid>
            {photos.map((photo, index) => (
              <PhotoThumbnail
                key={photo.photoId}
                imageUrl={photo.url}
                to={paths.eventPhoto(
                  session.accessCode,
                  photo.photoId,
                  viewerSourceToQuery({ kind: 'all' }),
                )}
                label={`사진 ${index + 1}`}
                onImageError={refetchOnImageError}
              />
            ))}
          </PhotoGrid>
          {/* 이 자리가 화면 가까이 오면 다음 30장을 부른다 */}
          <div ref={loadMoreTriggerRef} className="flex min-h-16 items-center justify-center">
            {photosQuery.isFetchingNextPage && (
              <span role="status" className="text-small text-muted-foreground">
                사진을 더 불러오는 중이에요
              </span>
            )}
            {photosQuery.isFetchNextPageError && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void photosQuery.fetchNextPage()}
              >
                더 불러오지 못했어요 · 다시 시도
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
