import { useInfiniteQuery } from '@tanstack/react-query'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, ShareIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useMergedPersonPhotos } from '@/entities/person/use-merged-person-photos'
import { eventPhotosInfiniteQueryOptions } from '@/entities/photo/photo-queries'
import {
  readViewerSource,
  viewerSourceToQuery,
  type ViewerSource,
} from '@/entities/photo/viewer-source'
import { useCurrentParticipantSession } from '@/entities/session/participant-session'
import { downloadPhoto, type SavablePhoto } from '@/features/photo-selection/photo-save-steps'
import { SaveProgressSheet } from '@/features/photo-selection/save-progress-sheet'
import { canShareImageFiles, detectSaveMethod } from '@/features/photo-selection/save-method'
import { usePhotoSaver } from '@/features/photo-selection/use-photo-saver'
import { usePrefetchedPhotoFile } from '@/features/photo-viewer/use-prefetched-photo-file'
import { ZoomablePhoto } from '@/features/photo-viewer/zoomable-photo'
import { useEventNotReadyRedirect } from '@/pages/participant/use-event-not-ready-redirect'
import { getErrorMessage } from '@/shared/api/error-messages'
import { paths } from '@/shared/config/paths'
import { reducedMotionMediaQuery, useMediaQuery } from '@/shared/lib/use-media-query'
import { useRefetchOnImageError } from '@/shared/lib/use-refetch-on-image-error'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

// ⑥ 사진 크게 보기: 참가자 레이아웃 밖의 어두운 전체 화면.
// 주소의 목록 출처(?persons= 또는 ?from=all)를 따라 좌우로 넘기고, 두 손가락·두 번 탭으로 확대하고, 저장·공유한다
export default function PhotoViewerPage() {
  const session = useCurrentParticipantSession()
  const { photoId } = useParams()
  const [searchParams] = useSearchParams()
  const source = readViewerSource(searchParams)
  if (!source) return <Navigate to={paths.eventHome(session.accessCode)} replace />
  return (
    <ViewerContent
      key={viewerSourceToQuery(source)}
      source={source}
      initialPhotoId={Number(photoId)}
    />
  )
}

// 목록 출처에 맞는 사진 목록을 받는다(⑤와 ⑦의 캐시를 그대로 쓴다)
function useViewerPhotos(eventId: number, source: ViewerSource) {
  const mergedPhotos = useMergedPersonPhotos(
    eventId,
    source.kind === 'persons' ? source.personIds : [],
  )
  const allPhotosQuery = useInfiniteQuery({
    ...eventPhotosInfiniteQueryOptions(eventId),
    enabled: source.kind === 'all',
  })

  if (source.kind === 'persons') {
    return {
      photos: mergedPhotos.photos as SavablePhoto[],
      totalCount: mergedPhotos.photos.length,
      isPending: mergedPhotos.isPending,
      error: mergedPhotos.error,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: () => {},
      refetch: mergedPhotos.refetch,
    }
  }
  return {
    photos: (allPhotosQuery.data?.pages.flatMap((page) => page.photos) ?? []) as SavablePhoto[],
    totalCount: allPhotosQuery.data?.pages[0]?.total ?? 0,
    isPending: allPhotosQuery.isPending,
    error: allPhotosQuery.error,
    hasNextPage: allPhotosQuery.hasNextPage,
    isFetchingNextPage: allPhotosQuery.isFetchingNextPage,
    fetchNextPage: () => void allPhotosQuery.fetchNextPage(),
    refetch: () => void allPhotosQuery.refetch(),
  }
}

function ViewerContent({
  source,
  initialPhotoId,
}: {
  source: ViewerSource
  initialPhotoId: number
}) {
  const session = useCurrentParticipantSession()
  const navigate = useNavigate()
  const location = useLocation()
  const viewerPhotos = useViewerPhotos(session.eventId, source)
  useEventNotReadyRedirect(viewerPhotos.error, session)
  const refetchOnImageError = useRefetchOnImageError(viewerPhotos.refetch)
  const sourceQuery = viewerSourceToQuery(source)

  const initialIndex = viewerPhotos.photos.findIndex((photo) => photo.photoId === initialPhotoId)
  // ⑦에서 뒤쪽 사진을 새로고침한 경우: 그 사진이 나올 때까지 다음 페이지를 이어 받는다
  const isSearchingInitialPhoto =
    initialIndex === -1 && viewerPhotos.hasNextPage && !viewerPhotos.isPending
  const { isFetchingNextPage, fetchNextPage } = viewerPhotos
  useEffect(() => {
    if (isSearchingInitialPhoto && !isFetchingNextPage) fetchNextPage()
  }, [isSearchingInitialPhoto, isFetchingNextPage, fetchNextPage])

  // 닫기: 목록에서 열었으면 이전 화면으로, 링크로 바로 들어왔으면 목록 화면으로
  const closeViewer = useCallback(() => {
    if (location.key !== 'default') {
      void navigate(-1)
      return
    }
    void navigate(
      source.kind === 'all'
        ? paths.eventAllPhotos(session.accessCode)
        : paths.eventPhotos(session.accessCode, source.personIds),
      { replace: true },
    )
  }, [location.key, navigate, source, session.accessCode])

  const selectPhoto = useCallback(
    (photo: SavablePhoto) =>
      void navigate(paths.eventPhoto(session.accessCode, photo.photoId, sourceQuery), {
        replace: true,
      }),
    [navigate, session.accessCode, sourceQuery],
  )
  const loadMoreNearEnd = useCallback(() => {
    if (viewerPhotos.hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [viewerPhotos.hasNextPage, isFetchingNextPage, fetchNextPage])

  if (viewerPhotos.isPending || isSearchingInitialPhoto) {
    return <ViewerFrame onClose={closeViewer} counter="" />
  }
  if (initialIndex === -1) {
    return (
      <ViewerFrame onClose={closeViewer} counter="">
        <div role="alert" className="flex flex-col items-center gap-4 px-6 text-center">
          <p className="text-headline">사진을 찾을 수 없어요</p>
          <p className="text-small text-dark-foreground-secondary">
            {viewerPhotos.error ? getErrorMessage(viewerPhotos.error) : '목록에서 다시 골라주세요.'}
          </p>
          <Button variant="secondary" onClick={closeViewer}>
            목록으로
          </Button>
        </div>
      </ViewerFrame>
    )
  }

  return (
    <ViewerCarousel
      photos={viewerPhotos.photos}
      totalCount={viewerPhotos.totalCount}
      initialIndex={initialIndex}
      onNearEnd={loadMoreNearEnd}
      onSelectPhoto={selectPhoto}
      onClose={closeViewer}
      onImageError={refetchOnImageError}
    />
  )
}

type ViewerCarouselProps = {
  photos: SavablePhoto[]
  totalCount: number
  initialIndex: number
  /** 끝에서 세 장 남았을 때(⑦ 다음 페이지 받기) */
  onNearEnd: () => void
  /** 넘겨서 보는 사진이 바뀌면 주소를 바꾼다(새로고침·공유해도 같은 사진) */
  onSelectPhoto: (photo: SavablePhoto) => void
  onClose: () => void
  onImageError: () => void
}

// 좌우로 넘기는 사진 묶음(Embla). 지금 사진과 앞뒤 한 장만 불러오고 나머지는 빈 칸으로 둔다
function ViewerCarousel({
  photos,
  totalCount,
  initialIndex,
  onNearEnd,
  onSelectPhoto,
  onClose,
  onImageError,
}: ViewerCarouselProps) {
  const [isZoomed, setIsZoomed] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  // Embla 옵션은 바뀌지 않게 둔다. 옵션이 바뀌면 Embla가 다시 초기화하고, 그때 옵션의 startIndex로 돌아간다.
  // 그래서 시작 위치는 처음 값으로 고정하고(넘길 때마다 initialIndex가 바뀜), 확대 여부는 ref로 읽는다
  const [startIndex] = useState(initialIndex)
  const isZoomedRef = useRef(false)
  useEffect(() => {
    isZoomedRef.current = isZoomed
  }, [isZoomed])
  // 확대 중에는 끌기를 확대 이동에 양보한다(true를 돌려줄 때만 Embla가 끌기를 처리)
  const allowDragWhenNotZoomed = useCallback(() => !isZoomedRef.current, [])
  // 동작 줄이기가 켜져 있으면 넘길 때 미끄러지지 않고 바로 다음 사진으로 바뀐다(Embla duration 0 = 즉시 이동)
  const prefersReducedMotion = useMediaQuery(reducedMotionMediaQuery)
  const [carouselRef, carouselApi] = useEmblaCarousel({
    startIndex,
    watchDrag: allowDragWhenNotZoomed,
    duration: prefersReducedMotion ? 0 : 22,
  })
  const [isZoomTipVisible, setIsZoomTipVisible] = useState(true)
  const saver = usePhotoSaver()
  const saveMethod = detectSaveMethod()
  const canShare = canShareImageFiles()
  const currentPhoto = photos[currentIndex]
  const prefetchedFile = usePrefetchedPhotoFile(currentPhoto, canShare)

  // 넘길 때마다 지금 번호를 기억하고, 주소를 바꾸고, 끝 가까이 오면 다음 페이지를 부른다
  useEffect(() => {
    if (!carouselApi) return
    const handleSelect = () => {
      const selectedIndex = carouselApi.selectedScrollSnap()
      setCurrentIndex(selectedIndex)
      setIsZoomed(false)
      if (photos[selectedIndex]) onSelectPhoto(photos[selectedIndex])
      if (selectedIndex >= photos.length - 3) onNearEnd()
    }
    carouselApi.on('select', handleSelect)
    return () => {
      carouselApi.off('select', handleSelect)
    }
  }, [carouselApi, photos, onSelectPhoto, onNearEnd])

  // 확대 안내는 처음 3초만 보여 준다
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsZoomTipVisible(false), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [])

  // PC 키보드: ←/→ 넘기기, Esc 닫기
  useEffect(() => {
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'ArrowLeft') carouselApi?.scrollPrev()
      if (keyboardEvent.key === 'ArrowRight') carouselApi?.scrollNext()
      if (keyboardEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [carouselApi, onClose])

  // [저장]·[공유]: 다운로드 방식이면 바로 내려받고, 공유 시트는 미리 받아 둔 파일로 바로 연다(없으면 준비 → 버튼)
  async function saveCurrentPhoto(purpose: 'save' | 'share') {
    if (!currentPhoto) return
    if (purpose === 'save' && saveMethod === 'download') {
      try {
        await downloadPhoto(currentPhoto)
        toast.success('사진을 저장했어요')
      } catch {
        toast.error('사진을 받지 못했어요. 잠시 후 다시 시도해주세요.')
      }
      return
    }
    if (prefetchedFile) {
      try {
        await navigator.share({ files: [prefetchedFile] })
        toast.success(purpose === 'save' ? '사진을 저장했어요' : '사진을 보냈어요')
      } catch (error) {
        // 공유 시트를 그냥 닫은 경우는 알리지 않는다
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          saver.start([currentPhoto], purpose)
        }
      }
      return
    }
    saver.start([currentPhoto], purpose)
  }

  return (
    <ViewerFrame
      onClose={onClose}
      counter={`${currentIndex + 1} / ${Math.max(totalCount, photos.length)}`}
      footer={
        <div className="grid grid-cols-2 px-16 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)] lg:mx-auto lg:w-[320px]">
          <ViewerActionButton
            icon={DownloadIcon}
            label="저장"
            onClick={() => void saveCurrentPhoto('save')}
          />
          {canShare && (
            <ViewerActionButton
              icon={ShareIcon}
              label="공유"
              onClick={() => void saveCurrentPhoto('share')}
            />
          )}
        </div>
      }
    >
      <div className="relative min-h-0 flex-1">
        <div ref={carouselRef} className="h-full overflow-hidden" aria-roledescription="carousel">
          <div className="flex h-full">
            {photos.map((photo, index) => (
              <div
                key={photo.photoId}
                className="h-full min-w-0 flex-[0_0_100%]"
                aria-roledescription="slide"
                aria-label={`${index + 1}번째 사진`}
                aria-hidden={index !== currentIndex}
              >
                {/* 지금 사진과 앞뒤 한 장만 불러온다(나머지는 빈 칸) */}
                {Math.abs(index - currentIndex) <= 1 && (
                  <ZoomablePhoto
                    imageUrl={photo.url}
                    alt={`사진 ${index + 1}`}
                    isActive={index === currentIndex}
                    onZoomChange={setIsZoomed}
                    onImageError={onImageError}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        {isZoomTipVisible && (
          <span className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-caption whitespace-nowrap text-white">
            두 번 탭하거나 두 손가락으로 확대
          </span>
        )}
        {/* PC: 마우스로 넘기는 화살표 */}
        <div className="pointer-events-none absolute inset-x-4 top-1/2 hidden -translate-y-1/2 justify-between lg:flex">
          <ViewerArrowButton
            label="이전 사진"
            icon={ChevronLeftIcon}
            isHidden={currentIndex === 0}
            onClick={() => carouselApi?.scrollPrev()}
          />
          <ViewerArrowButton
            label="다음 사진"
            icon={ChevronRightIcon}
            isHidden={currentIndex === photos.length - 1}
            onClick={() => carouselApi?.scrollNext()}
          />
        </div>
      </div>
      <SaveProgressSheet
        progress={saver.progress}
        onOpenShareSheet={() => void saver.openShareSheet()}
        onDownloadInstead={saver.downloadInstead}
        onCancel={saver.cancel}
      />
    </ViewerFrame>
  )
}

// 어두운 전체 화면 틀: 위쪽 닫기·번호, 가운데 내용, 아래쪽 버튼
function ViewerFrame({
  onClose,
  counter,
  footer,
  children,
}: {
  onClose: () => void
  counter: string
  footer?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="fixed inset-0 flex flex-col bg-dark-bg text-dark-foreground">
      <div className="flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top)+8px)] pb-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="닫기"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <XIcon className="size-6" />
        </Button>
        <span role="status" className="text-[15px] font-semibold">
          {counter}
        </span>
        <div className="size-11" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center">{children}</div>
      {footer}
    </div>
  )
}

// 아래쪽 [저장]·[공유] 버튼(아이콘 + 작은 글자)
function ViewerActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 flex-col items-center justify-center gap-1 rounded-md text-caption text-white outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
    >
      <Icon className="size-5.5" aria-hidden="true" />
      {label}
    </button>
  )
}

// PC 좌우 화살표. 처음·끝 사진에서는 자리만 남기고 숨긴다
function ViewerArrowButton({
  label,
  icon: Icon,
  isHidden,
  onClick,
}: {
  label: string
  icon: ComponentType<{ className?: string }>
  isHidden: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'pointer-events-auto flex size-12 items-center justify-center rounded-full bg-white/10 text-white outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white',
        isHidden && 'invisible',
      )}
    >
      <Icon className="size-6" />
    </button>
  )
}
