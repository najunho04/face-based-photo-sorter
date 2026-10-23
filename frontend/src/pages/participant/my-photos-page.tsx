import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeftIcon,
  DownloadIcon,
  FolderXIcon,
  ShareIcon,
  UserRoundCheckIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { addMyPersonIds, readMyPersonIds } from '@/entities/person/my-person-storage'
import { formatPersonName } from '@/entities/person/person-name'
import { personListQueryOptions } from '@/entities/person/person-queries'
import { useMergedPersonPhotos } from '@/entities/person/use-merged-person-photos'
import { PhotoGrid } from '@/entities/photo/photo-grid'
import { parsePersonIdsParameter, viewerSourceToQuery } from '@/entities/photo/viewer-source'
import { useCurrentParticipantSession } from '@/entities/session/participant-session'
import { SaveProgressSheet } from '@/features/photo-selection/save-progress-sheet'
import { SelectablePhotoTile } from '@/features/photo-selection/selectable-photo-tile'
import { usePhotoSaver } from '@/features/photo-selection/use-photo-saver'
import { usePhotoSelection } from '@/features/photo-selection/use-photo-selection'
import { useEventNotReadyRedirect } from '@/pages/participant/use-event-not-ready-redirect'
import { getErrorMessage } from '@/shared/api/error-messages'
import { paths } from '@/shared/config/paths'
import { desktopMediaQuery, useMediaQuery } from '@/shared/lib/use-media-query'
import { useRefetchOnImageError } from '@/shared/lib/use-refetch-on-image-error'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { ErrorState } from '@/shared/ui/error-state'
import { FaceCrop } from '@/shared/ui/face-crop'
import { PhotoPlaceholder } from '@/shared/ui/photo-placeholder'

// ⑤ 내 사진(폴더 합쳐 보기) · ⑤-1 선택 · ⑤-2 저장 (휴대폰 시안 ⑤·⑤-1·⑤-2, PC P5).
// 주소의 persons=3,12 폴더 사진을 합쳐(중복 제거) 보여 주고, 골라서 저장·공유한다
export default function MyPhotosPage() {
  const session = useCurrentParticipantSession()
  const [searchParams] = useSearchParams()
  const personIds = parsePersonIdsParameter(searchParams.get('persons'))
  if (personIds.length === 0) return <Navigate to={paths.eventHome(session.accessCode)} replace />
  return <MyPhotosContent key={personIds.join(',')} personIds={personIds} />
}

function MyPhotosContent({ personIds }: { personIds: number[] }) {
  const session = useCurrentParticipantSession()
  const isDesktop = useMediaQuery(desktopMediaQuery)
  const mergedPhotos = useMergedPersonPhotos(session.eventId, personIds)
  useEventNotReadyRedirect(mergedPhotos.error, session)
  const refetchOnImageError = useRefetchOnImageError(mergedPhotos.refetch)
  // 대표 얼굴은 ②에서 받아 둔 사람 목록에서 찾는다(사진 1장뿐인 폴더는 없을 수 있음)
  const personsQuery = useQuery(
    personListQueryOptions({ eventId: session.eventId, minPhotos: 2, requester: 'participant' }),
  )
  const selection = usePhotoSelection()
  const saver = usePhotoSaver()
  const [myPersonIds, setMyPersonIds] = useState(() => readMyPersonIds(session.eventId))

  const photos = mergedPhotos.photos
  const isMyFolder = personIds.every((personId) => myPersonIds.includes(personId))
  const photoCount = photos.length
  const title = isMyFolder
    ? `내 사진 ${photoCount}장`
    : personIds.length === 1 && mergedPhotos.labels[0]
      ? `${formatPersonName(mergedPhotos.labels[0])} 사진 ${photoCount}장`
      : `사진 ${photoCount}장`
  const selectedPhotos = photos.filter((photo) =>
    selection.selectedPhotoIds.includes(photo.photoId),
  )
  const viewerSourceQuery = viewerSourceToQuery({ kind: 'persons', personIds })

  // [이 사람이 나예요]: 이 폴더를 '내 폴더'에 더한다(결정 기록 4·6단계)
  function rememberAsMine() {
    addMyPersonIds(session.eventId, personIds)
    setMyPersonIds(readMyPersonIds(session.eventId))
    toast.success('내 사진에 추가했어요')
  }

  if (!mergedPhotos.isPending && mergedPhotos.missingPersonIds.length === personIds.length) {
    return (
      <EmptyState
        icon={FolderXIcon}
        title="사진 폴더를 찾을 수 없어요"
        description="사람별 사진에서 다시 골라주세요."
        className="flex-1 justify-center"
        action={
          <Button asChild>
            <Link to={paths.eventHome(session.accessCode)}>사람별 사진으로</Link>
          </Button>
        }
      />
    )
  }

  const faces = (
    <div className="flex shrink-0" aria-hidden="true">
      {personIds.slice(0, 3).map((personId, index) => {
        const person = personsQuery.data?.persons.find(
          (candidate) => candidate.personId === personId,
        )
        const overlapClassName = cn(
          'rounded-full ring-2 ring-background',
          index > 0 && '-ml-3.5 lg:-ml-4.5',
        )
        const faceSize = isDesktop ? 64 : 48
        return person ? (
          <FaceCrop
            key={personId}
            imageUrl={person.repFace.url}
            faceBox={person.repFace.bbox}
            size={faceSize}
            className={overlapClassName}
          />
        ) : (
          <span
            key={personId}
            className={cn('bg-placeholder', overlapClassName)}
            style={{ width: faceSize, height: faceSize }}
          />
        )
      })}
    </div>
  )

  return (
    <div
      className={cn(
        'flex flex-col lg:px-6 lg:pb-12',
        // 휴대폰은 아래 고정 막대만큼 여백을 둔다
        'pb-[calc(env(safe-area-inset-bottom)+88px)]',
      )}
    >
      {/* 휴대폰 위쪽: 평소 [뒤로] … [선택] / 선택 모드 [취소] N장 선택됨 [전체 선택] */}
      <div className="flex items-center justify-between px-2.5 pt-[calc(env(safe-area-inset-top)+8px)] pb-1 lg:hidden">
        {selection.isSelecting ? (
          <>
            <Button variant="ghost" className="px-2.5 text-[15px]" onClick={selection.exit}>
              취소
            </Button>
            <span role="status" className="text-body font-bold">
              {selection.selectedPhotoIds.length}장 선택됨
            </span>
            <Button
              variant="ghost"
              className="px-2.5 text-[15px] text-primary"
              onClick={() => selection.selectAll(photos.map((photo) => photo.photoId))}
            >
              전체 선택
            </Button>
          </>
        ) : (
          <>
            <Button asChild variant="ghost" size="icon" aria-label="사람별 사진으로">
              <Link to={paths.eventHome(session.accessCode)}>
                <ChevronLeftIcon className="size-6" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="px-2.5 text-[15px] text-primary"
              onClick={() => selection.enter()}
              disabled={photoCount === 0}
            >
              선택
            </Button>
          </>
        )}
      </div>

      <Link
        to={paths.eventHome(session.accessCode)}
        className="hidden min-h-11 items-center self-start pt-5 text-small font-semibold text-muted-foreground lg:flex"
      >
        ← 사람별 사진
      </Link>

      {!selection.isSelecting && (
        <div className="flex flex-col gap-3 px-5 pb-4 lg:px-0 lg:pt-2 lg:pb-5">
          <div className="flex flex-wrap items-center gap-3 lg:justify-between lg:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-4">
              {faces}
              <div className="flex min-w-0 flex-col gap-0.5 lg:gap-1">
                <h1 className="text-[22px] leading-8 font-bold lg:text-display">
                  {mergedPhotos.isPending ? '사진을 불러오는 중' : title}
                </h1>
                <span className="text-[13px] leading-5 text-muted-foreground lg:text-small">
                  {mergedPhotos.folderCount > 1 &&
                    `폴더 ${mergedPhotos.folderCount}개를 합쳐서 보여드려요`}
                  {isDesktop && (mergedPhotos.folderCount > 1 ? ' · ' : '')}
                  {isDesktop && '사진을 눌러 크게 보거나, 골라서 저장하세요'}
                </span>
              </div>
            </div>
            <Button
              variant={isDesktop ? 'default' : 'secondary'}
              size={isDesktop ? 'default' : 'sm'}
              className="h-10 lg:h-11"
              onClick={() => saver.start(photos, 'save')}
              disabled={photoCount === 0}
            >
              <DownloadIcon />
              전체 저장
            </Button>
          </div>
          {!isMyFolder && !mergedPhotos.isPending && (
            <Button variant="secondary" size="sm" className="self-start" onClick={rememberAsMine}>
              <UserRoundCheckIcon />이 사람이 나예요
            </Button>
          )}
        </div>
      )}

      {/* PC 선택 막대(P5): 고른 사진이 있을 때만 */}
      {isDesktop && selectedPhotos.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-primary-border bg-background px-4 py-2.5">
          <span role="status" className="text-small font-semibold text-primary-hover">
            {selectedPhotos.length}장 선택됨
          </span>
          <div className="flex-1" />
          <Button variant="secondary" size="sm" onClick={() => saver.start(selectedPhotos, 'save')}>
            선택한 사진 저장
          </Button>
          <Button variant="ghost" size="sm" onClick={selection.clear}>
            선택 해제
          </Button>
        </div>
      )}

      {mergedPhotos.isPending ? (
        <PhotoGrid>
          {Array.from({ length: 15 }, (_, index) => (
            <PhotoPlaceholder key={index} className="lg:aspect-[4/3]" />
          ))}
        </PhotoGrid>
      ) : mergedPhotos.error && photoCount === 0 ? (
        <ErrorState
          title="사진을 불러오지 못했어요"
          description={getErrorMessage(mergedPhotos.error)}
          onRetry={mergedPhotos.refetch}
        />
      ) : (
        <PhotoGrid>
          {photos.map((photo, index) => (
            <SelectablePhotoTile
              key={photo.photoId}
              imageUrl={photo.url}
              label={`사진 ${index + 1}`}
              viewerPath={paths.eventPhoto(session.accessCode, photo.photoId, viewerSourceQuery)}
              isSelecting={selection.isSelecting}
              isSelected={selection.selectedPhotoIds.includes(photo.photoId)}
              showCheckbox={isDesktop}
              onToggle={() => selection.toggle(photo.photoId)}
              onLongPress={() => {
                if (!isDesktop) selection.enter(photo.photoId)
              }}
              onImageError={refetchOnImageError}
            />
          ))}
        </PhotoGrid>
      )}

      {/* 휴대폰 아래 고정 막대: 평소 '전체 사진 보기' 안내 / 선택 모드 [공유] [저장] */}
      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[560px] border-t border-border bg-background px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)] lg:hidden">
        {selection.isSelecting ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="h-13"
              onClick={() => saver.start(selectedPhotos, 'share')}
              aria-disabled={selectedPhotos.length === 0}
            >
              <ShareIcon />
              공유
            </Button>
            <Button
              className="h-13"
              onClick={() => saver.start(selectedPhotos, 'save')}
              aria-disabled={selectedPhotos.length === 0}
            >
              <DownloadIcon />
              저장
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-small text-muted-foreground">못 찾은 사진이 있나요?</span>
            <Link
              to={paths.eventAllPhotos(session.accessCode)}
              className="flex min-h-11 items-center text-small font-semibold text-primary"
            >
              전체 사진 보기
            </Link>
          </div>
        )}
      </div>

      <SaveProgressSheet
        progress={saver.progress}
        onOpenShareSheet={() => void saver.openShareSheet()}
        onDownloadInstead={saver.downloadInstead}
        onCancel={saver.cancel}
      />
    </div>
  )
}
