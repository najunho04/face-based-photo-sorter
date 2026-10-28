import { useQuery } from '@tanstack/react-query'
import { ImagesIcon } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { eventProgressQueryOptions } from '@/entities/event/event-queries'
import { formatPersonName } from '@/entities/person/person-name'
import { personListQueryOptions, personPhotosQueryOptions } from '@/entities/person/person-queries'
import { PhotoGrid } from '@/entities/photo/photo-grid'
import {
  AdministratorPageBody,
  AdministratorPageHeader,
} from '@/pages/admin/administrator-page-header'
import { getErrorMessage } from '@/shared/api/error-messages'
import { paths } from '@/shared/config/paths'
import { useRefetchOnImageError } from '@/shared/lib/use-refetch-on-image-error'
import { cn } from '@/shared/lib/utils'
import { EmptyState } from '@/shared/ui/empty-state'
import { ErrorState } from '@/shared/ui/error-state'
import { FaceCrop } from '@/shared/ui/face-crop'
import { PhotoPlaceholder } from '@/shared/ui/photo-placeholder'

// A7 사람 폴더 사진: 한 사람이 나온 사진을 모아 본다(#9, 관리자 토큰). 참가자 화면과 같은 사진이다
export default function PersonFolderPage() {
  const parameters = useParams()
  const eventId = Number(parameters.eventId)
  const personId = Number(parameters.personId)
  const progressQuery = useQuery(eventProgressQueryOptions(eventId))
  const photosQuery = useQuery(
    personPhotosQueryOptions({ eventId, personId, requester: 'administrator' }),
  )
  // 대표 얼굴은 사람 목록(전체)에서 찾는다(A6에서 받아 둔 것을 재사용)
  const personsQuery = useQuery(personListQueryOptions({ eventId, requester: 'administrator' }))
  const refetchOnImageError = useRefetchOnImageError(photosQuery.refetch)
  const person = personsQuery.data?.persons.find((candidate) => candidate.personId === personId)
  const personName = photosQuery.data ? formatPersonName(photosQuery.data.label) : '사람 폴더'
  const eventName = progressQuery.data?.name ?? ''
  // 대표 얼굴(사람 목록을 받기 전·얼굴이 없으면 사람 아이콘)과 장 수 안내. PC는 머리글 제목 옆, 휴대폰은 본문 첫 줄에 둔다
  const representativeFace = (
    <FaceCrop
      imageUrl={person?.repFace?.url ?? null}
      faceBox={person?.repFace?.bbox ?? null}
      size={64}
    />
  )
  const folderSummary = `${photosQuery.data ? `사진 ${photosQuery.data.total}장 · ` : ''}참가자에게도 같은 사진이 보여요`

  return (
    <>
      {/* 시안 A7: 경로 줄 아래 20px에 얼굴, 그 오른쪽에 큰 제목과 장 수 안내 */}
      <AdministratorPageHeader
        title={personName}
        eventName={eventName}
        backTo={paths.administratorEventResult(eventId)}
        breadcrumbs={[
          { label: '최근 행사', to: paths.administratorEvents },
          { label: eventName, to: paths.administratorEventResult(eventId) },
          { label: personName },
        ]}
        leadingVisual={representativeFace}
        description={folderSummary}
      />
      <AdministratorPageBody>
        {/* 휴대폰은 위쪽 머리글에 제목이 있으니 여기서는 얼굴과 장 수 안내만 보여 준다 */}
        <div className="flex items-center gap-4 lg:hidden">
          {representativeFace}
          <span className="text-small text-muted-foreground">{folderSummary}</span>
        </div>

        {photosQuery.isPending ? (
          <PhotoGrid>
            {Array.from({ length: 15 }, (_, index) => (
              <PhotoPlaceholder key={index} className="lg:aspect-[4/3]" />
            ))}
          </PhotoGrid>
        ) : photosQuery.isError ? (
          <ErrorState
            title="사진을 불러오지 못했어요"
            description={getErrorMessage(photosQuery.error)}
            onRetry={() => void photosQuery.refetch()}
          />
        ) : photosQuery.data.photos.length === 0 ? (
          // 폴더는 있지만 사진이 없을 때(정상 흐름에선 드묾: 사진이 지워졌거나 다시 묶인 경우)
          <EmptyState
            icon={ImagesIcon}
            title="이 사람이 나온 사진이 없어요"
            description="분류 결과로 돌아가 다른 사람 폴더를 열어주세요."
          />
        ) : (
          <PhotoGrid>
            {photosQuery.data.photos.map((photo, index) => (
              <ReadOnlyPhotoTile
                key={photo.photoId}
                imageUrl={photo.url}
                label={`사진 ${index + 1}`}
                onImageError={refetchOnImageError}
              />
            ))}
          </PhotoGrid>
        )}
      </AdministratorPageBody>
    </>
  )
}

// 보기만 하는 사진 칸(시안 A7). 화면에 보일 때만 불러오고, 불러오기 전에는 회색 칸
function ReadOnlyPhotoTile({
  imageUrl,
  label,
  onImageError,
}: {
  imageUrl: string
  label: string
  onImageError: () => void
}) {
  const [loadedUrl, setLoadedUrl] = useState<string>()
  return (
    <div className="relative aspect-square overflow-hidden bg-placeholder lg:aspect-[4/3]">
      <img
        src={imageUrl}
        alt={label}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoadedUrl(imageUrl)}
        onError={onImageError}
        className={cn(
          'size-full object-cover transition-opacity duration-200',
          loadedUrl === imageUrl ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
