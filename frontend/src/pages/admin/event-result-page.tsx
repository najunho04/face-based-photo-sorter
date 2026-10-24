import { useQuery } from '@tanstack/react-query'
import { QrCodeIcon, UsersRoundIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { eventProgressQueryOptions } from '@/entities/event/event-queries'
import { EventStatusBadge } from '@/entities/event/event-status-badge'
import { formatPersonName } from '@/entities/person/person-name'
import { personListQueryOptions } from '@/entities/person/person-queries'
import type { Person } from '@/entities/person/person-types'
import { EventShareDialog } from '@/features/publish/event-share-dialog'
import {
  AdministratorPageBody,
  AdministratorPageHeader,
} from '@/pages/admin/administrator-page-header'
import { getErrorMessage } from '@/shared/api/error-messages'
import { paths } from '@/shared/config/paths'
import { desktopMediaQuery, useMediaQuery } from '@/shared/lib/use-media-query'
import { useRefetchOnImageError } from '@/shared/lib/use-refetch-on-image-error'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { EmptyState } from '@/shared/ui/empty-state'
import { ErrorState } from '@/shared/ui/error-state'
import { FaceCrop } from '@/shared/ui/face-crop'
import { Skeleton } from '@/shared/ui/skeleton'

// A6 분류 결과 · M3: 사람별로 묶인 폴더를 보여 준다(#10, 관리자 토큰).
// "사진 한 장에만 나온 사람 숨기기"를 켜면 참가자 화면과 같은 목록(minPhotos=2)이다
export default function EventResultPage() {
  const eventId = Number(useParams().eventId)
  const progressQuery = useQuery(eventProgressQueryOptions(eventId))
  const [hidesSinglePhotoPersons, setHidesSinglePhotoPersons] = useState(true)
  const personsQuery = useQuery({
    ...personListQueryOptions({
      eventId,
      minPhotos: hidesSinglePhotoPersons ? 2 : undefined,
      requester: 'administrator',
    }),
    enabled: progressQuery.data?.status === 'open',
  })
  const refetchOnImageError = useRefetchOnImageError(personsQuery.refetch)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const toggleId = useId()

  if (progressQuery.isPending) {
    return (
      <AdministratorPageBody>
        <Skeleton className="h-60 rounded-lg" />
      </AdministratorPageBody>
    )
  }
  if (progressQuery.isError) {
    return (
      <AdministratorPageBody>
        <ErrorState
          title="행사 정보를 불러오지 못했어요"
          description={getErrorMessage(progressQuery.error)}
          onRetry={() => void progressQuery.refetch()}
        />
      </AdministratorPageBody>
    )
  }
  const progress = progressQuery.data
  // 아직 공개 전이면 정리 중 화면으로
  if (progress.status !== 'open') {
    return <Navigate to={paths.administratorEventProcessing(eventId)} replace />
  }

  return (
    <>
      <AdministratorPageHeader
        title="분류 결과"
        eventName={progress.name}
        backTo={paths.administratorEvents}
        breadcrumbs={[
          { label: '최근 행사', to: paths.administratorEvents },
          { label: progress.name },
        ]}
        badge={<EventStatusBadge status={progress.status} />}
        description={`사람 ${progress.personCount ?? 0}명 · 참가자가 지금 볼 수 있어요`}
        actions={
          <Button
            variant="secondary"
            size="sm"
            className="h-10"
            onClick={() => setIsShareDialogOpen(true)}
          >
            <QrCodeIcon />
            인증코드·QR 보기
          </Button>
        }
        mobileAction={
          <Button
            variant="secondary"
            size="sm"
            className="h-10"
            onClick={() => setIsShareDialogOpen(true)}
          >
            QR 보기
          </Button>
        }
      />
      <AdministratorPageBody>
        <div className="flex items-center gap-2 lg:hidden">
          <EventStatusBadge status={progress.status} />
          <span className="text-[13px] text-muted-foreground">
            사람 {progress.personCount ?? 0}명 · 사진 많은 순
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-0.5">
          <label
            htmlFor={toggleId}
            className="flex min-h-11 cursor-pointer items-center gap-2.5 text-small font-medium"
          >
            <Checkbox
              id={toggleId}
              checked={hidesSinglePhotoPersons}
              onCheckedChange={(checked) => setHidesSinglePhotoPersons(checked === true)}
            />
            사진 한 장에만 나온 사람 숨기기
          </label>
          <span className="hidden text-[13px] text-muted-foreground lg:inline">사진 많은 순</span>
        </div>

        {personsQuery.isPending ? (
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] lg:gap-3">
            {Array.from({ length: 12 }, (_, index) => (
              <Skeleton key={index} className="h-36 rounded-lg" />
            ))}
          </div>
        ) : personsQuery.isError ? (
          <ErrorState
            title="사람 폴더를 불러오지 못했어요"
            description={getErrorMessage(personsQuery.error)}
            onRetry={() => void personsQuery.refetch()}
          />
        ) : personsQuery.data.persons.length === 0 ? (
          <EmptyState
            icon={UsersRoundIcon}
            title="묶인 사람이 없어요"
            description="'사진 한 장에만 나온 사람 숨기기'를 끄면 모든 폴더를 볼 수 있어요."
          />
        ) : (
          <ul className="grid grid-cols-3 gap-2 lg:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] lg:gap-3">
            {personsQuery.data.persons.map((person) => (
              <li key={person.personId}>
                <PersonFolderCard
                  person={person}
                  to={paths.administratorPersonPhotos(eventId, person.personId)}
                  onImageError={refetchOnImageError}
                />
              </li>
            ))}
          </ul>
        )}
      </AdministratorPageBody>

      <EventShareDialog
        isOpen={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        accessCode={progress.accessCode}
      />
    </>
  )
}

// 사람 폴더 카드(시안 A6·M3): 얼굴 76px(휴대폰 64px), "사람 3", "사진 N장"
function PersonFolderCard({
  person,
  to,
  onImageError,
}: {
  person: Person
  to: string
  onImageError: () => void
}) {
  const isDesktop = useMediaQuery(desktopMediaQuery)
  return (
    <Link
      to={to}
      aria-label={`${formatPersonName(person.label)}, 사진 ${person.photoCount}장`}
      className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background px-1.5 pt-3.5 pb-2.5 transition-colors outline-none hover:border-primary-border focus-visible:ring-2 focus-visible:ring-ring lg:gap-2 lg:px-3 lg:pt-4.5 lg:pb-3.5"
    >
      <FaceCrop
        imageUrl={person.repFace?.url ?? null}
        faceBox={person.repFace?.bbox ?? null}
        size={isDesktop ? 76 : 64}
        onImageError={onImageError}
      />
      <span aria-hidden="true" className="text-[13px] font-semibold lg:text-small">
        {formatPersonName(person.label)}
      </span>
      <span aria-hidden="true" className="text-caption text-muted-foreground">
        사진 {person.photoCount}장
      </span>
    </Link>
  )
}
