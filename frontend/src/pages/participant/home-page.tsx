import { useQuery } from '@tanstack/react-query'
import { CameraIcon, UsersRoundIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { readMyPersonIds } from '@/entities/person/my-person-storage'
import { PersonFaceTile } from '@/entities/person/person-face-tile'
import { personListQueryOptions } from '@/entities/person/person-queries'
import { useCurrentParticipantSession } from '@/entities/session/participant-session'
import { hasFaceConsent, saveFaceConsent } from '@/features/selfie-search/face-consent-storage'
import { MyPhotosShortcut } from '@/pages/participant/my-photos-shortcut'
import { useEventNotReadyRedirect } from '@/pages/participant/use-event-not-ready-redirect'
import { getErrorMessage } from '@/shared/api/error-messages'
import { paths } from '@/shared/config/paths'
import { desktopMediaQuery, useMediaQuery } from '@/shared/lib/use-media-query'
import { useRefetchOnImageError } from '@/shared/lib/use-refetch-on-image-error'
import { AppLogo } from '@/shared/ui/app-logo'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { ErrorState } from '@/shared/ui/error-state'
import { Skeleton } from '@/shared/ui/skeleton'

// ②-1 동의 시트(바닥 시트 라이브러리 포함)는 첫 화면 JS에서 빼고 따로 받는다(8단계: 첫 화면 줄이기)
const importFaceConsentSheet = () => import('@/features/selfie-search/face-consent-sheet')
const FaceConsentSheet = lazy(async () => ({
  default: (await importFaceConsentSheet()).FaceConsentSheet,
}))

/** 참가자 화면은 사진 2장 이상 나온 사람만 보여 준다(배경에 한 번 지나간 사람 숨김, 결정 기록) */
const participantMinimumPhotos = 2

// ② 사람별 사진 (시안 ②, ②-2, PC P2): 공개된 행사의 첫 화면.
// 내 폴더를 기억해 두었으면 ②-2 바로가기를, 아니면 '셀카로 내 사진 빨리 찾기'를 크게 보여 준다
export default function HomePage() {
  const session = useCurrentParticipantSession()
  const personsQuery = useQuery(
    personListQueryOptions({
      eventId: session.eventId,
      minPhotos: participantMinimumPhotos,
      requester: 'participant',
    }),
  )
  useEventNotReadyRedirect(personsQuery.error, session)
  const refetchOnImageError = useRefetchOnImageError(personsQuery.refetch)
  const myPersonIds = readMyPersonIds(session.eventId)
  const hasMyPersons = myPersonIds.length > 0
  const navigate = useNavigate()
  const isDesktop = useMediaQuery(desktopMediaQuery)
  const [isConsentSheetOpen, setIsConsentSheetOpen] = useState(false)
  // 시트는 한 번 연 뒤부터 계속 붙여 둔다(닫힐 때 내려가는 움직임이 끊기지 않게)
  const [hasOpenedConsentSheet, setHasOpenedConsentSheet] = useState(false)

  // 첫 화면을 그린 뒤 시트 코드를 미리 받아 둔다(버튼을 눌렀을 때 기다리지 않게)
  useEffect(() => {
    void importFaceConsentSheet()
  }, [])

  // 셀카로 찾기: 휴대폰에서 아직 동의하지 않았으면 ②-1 동의 시트를 먼저 띄운다(PC는 촬영 화면 옆 칸에서 동의)
  function startSelfieSearch() {
    if (isDesktop || hasFaceConsent(session.eventId)) {
      void navigate(paths.eventCamera(session.accessCode))
    } else {
      setHasOpenedConsentSheet(true)
      setIsConsentSheetOpen(true)
    }
  }

  return (
    <div className="flex flex-col pb-[calc(env(safe-area-inset-bottom)+32px)] lg:pb-12">
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+16px)] lg:hidden">
        <AppLogo size="medium" />
      </div>

      <div className="flex flex-col gap-5 px-5 pt-5 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:px-6 lg:pt-10">
        <div className="flex flex-col gap-1">
          {/* 휴대폰은 행사 이름이 제목, PC는 머리글에 행사 이름이 있으므로 '사람별 사진'이 제목 */}
          <h1 className="text-title-1 lg:text-display">
            <span className="lg:hidden">{session.eventName}</span>
            <span className="hidden lg:inline">사람별 사진</span>
          </h1>
          <p className="text-small text-muted-foreground lg:text-[15px]">
            {personsQuery.data
              ? `사진 2장 이상 나온 사람 ${personsQuery.data.total}명 · 사진 많은 순`
              : '사진 많은 순'}
          </p>
        </div>
        {!hasMyPersons && (
          <Button size="lg" onClick={startSelfieSearch}>
            <CameraIcon />
            셀카로 내 사진 빨리 찾기
          </Button>
        )}
      </div>

      {hasMyPersons && (
        <div className="px-5 pt-5 lg:max-w-[560px] lg:px-6">
          <MyPhotosShortcut
            eventId={session.eventId}
            accessCode={session.accessCode}
            myPersonIds={myPersonIds}
            persons={personsQuery.data?.persons}
            onImageError={refetchOnImageError}
          />
        </div>
      )}

      <div className="flex items-center justify-between px-5 pt-5 pb-3 lg:hidden">
        <h2 className="text-headline">사람별 사진</h2>
        <Link
          to={paths.eventAllPhotos(session.accessCode)}
          className="flex min-h-11 items-center text-small font-semibold text-primary"
        >
          전체 사진 보기
        </Link>
      </div>

      <div className="px-5 lg:px-6 lg:pt-7">
        {personsQuery.isPending ? (
          <PersonGridSkeleton />
        ) : personsQuery.isError ? (
          <ErrorState
            title="사람별 사진을 불러오지 못했어요"
            description={getErrorMessage(personsQuery.error)}
            onRetry={() => void personsQuery.refetch()}
          />
        ) : personsQuery.data.persons.length === 0 ? (
          <EmptyState
            icon={UsersRoundIcon}
            title="아직 2장 이상 나온 사람이 없어요"
            description="전체 사진에서 직접 찾아보세요."
            action={
              <Button asChild variant="secondary">
                <Link to={paths.eventAllPhotos(session.accessCode)}>전체 사진 보기</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-3 gap-3 lg:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] lg:gap-4">
            {personsQuery.data.persons.map((person) => (
              <li key={person.personId}>
                <PersonFaceTile
                  person={person}
                  to={paths.eventPhotos(session.accessCode, [person.personId])}
                  onImageError={refetchOnImageError}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {hasOpenedConsentSheet && (
        <Suspense fallback={null}>
          <FaceConsentSheet
            isOpen={isConsentSheetOpen}
            onOpenChange={setIsConsentSheetOpen}
            onAgree={() => {
              saveFaceConsent(session.eventId)
              void navigate(paths.eventCamera(session.accessCode))
            }}
          />
        </Suspense>
      )}
    </div>
  )
}

// 사람 목록을 불러오는 동안 같은 모양의 회색 동그라미로 자리를 잡는다(화면이 들썩이지 않게)
function PersonGridSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-3 gap-3 lg:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] lg:gap-4"
    >
      {Array.from({ length: 12 }, (_, index) => (
        <div key={index} className="flex flex-col items-center gap-1.5 py-1.5 lg:py-4">
          <Skeleton className="size-22 rounded-full lg:size-24" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  )
}
