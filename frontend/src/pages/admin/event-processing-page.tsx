import { useQuery } from '@tanstack/react-query'
import { BellIcon, LoaderCircleIcon, QrCodeIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { EventProgressSteps } from '@/entities/event/event-progress-steps'
import { eventProgressQueryOptions } from '@/entities/event/event-queries'
import type { EventProgress } from '@/entities/event/event-types'
import { EventShareDialog } from '@/features/publish/event-share-dialog'
import {
  AdministratorPageBody,
  AdministratorPageHeader,
} from '@/pages/admin/administrator-page-header'
import { getErrorMessage } from '@/shared/api/error-messages'
import { paths } from '@/shared/config/paths'
import { Button } from '@/shared/ui/button'
import { ErrorState } from '@/shared/ui/error-state'
import { Progress } from '@/shared/ui/progress'
import { Skeleton } from '@/shared/ui/skeleton'

/** 정리 진행 상황을 다시 받는 간격(계획 문서: 3초) */
const processingPollingMilliseconds = 3000

// A5 사진 정리 중: 3초마다 #5를 받아 단계·진행을 보여 준다.
// 공개되면 A6으로 넘어가고(결정 기록 7단계), 다른 탭에 있으면 브라우저 알림·탭 제목 '(완료)'로 알린다
export default function EventProcessingPage() {
  const eventId = Number(useParams().eventId)
  const navigate = useNavigate()
  const progressQuery = useQuery(eventProgressQueryOptions(eventId, processingPollingMilliseconds))
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const notification = useCompletionNotificationPermission()
  const progress = progressQuery.data
  const isOpen = progress?.status === 'open'
  const eventName = progress?.name

  // 공개되면: 보고 있으면 바로 A6으로, 다른 탭이면 알림을 보내고 돌아왔을 때 A6으로 간다
  useEffect(() => {
    if (!isOpen) return
    const goToResult = () => {
      toast.success('사진 정리가 끝났어요. 참가자에게 공개됐어요.')
      void navigate(paths.administratorEventResult(eventId), { replace: true })
    }
    if (document.visibilityState === 'visible') {
      goToResult()
      return
    }
    document.title = `(완료) ${document.title}`
    if (notification.permission === 'granted') {
      new Notification('사진 정리가 끝났어요', { body: `${eventName} · 참가자에게 공개됐어요` })
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') goToResult()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isOpen, eventId, eventName, navigate, notification.permission])

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
          title="진행 상황을 불러오지 못했어요"
          description={getErrorMessage(progressQuery.error)}
          onRetry={() => void progressQuery.refetch()}
        />
      </AdministratorPageBody>
    )
  }
  if (progressQuery.data.status === 'uploading') {
    return <Navigate to={paths.administratorEventUpload(eventId)} replace />
  }
  const currentProgress = progressQuery.data

  return (
    <>
      <AdministratorPageHeader
        title="사진 정리 중"
        eventName={currentProgress.name}
        backTo={paths.administratorEvents}
        breadcrumbs={[
          { label: '최근 행사', to: paths.administratorEvents },
          { label: currentProgress.name },
        ]}
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
        <EventProgressSteps status={currentProgress.status} />
        <ProcessingStatusCard progress={currentProgress} />

        {notification.permission !== 'unsupported' && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-5 py-4">
            <div className="flex items-center gap-3">
              <BellIcon className="size-5.5 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <span className="text-small font-semibold">
                  {notification.permission === 'default'
                    ? '끝나면 알려드릴까요?'
                    : '끝나면 알려드릴게요'}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {notification.permission === 'denied'
                    ? "브라우저 알림이 꺼져 있어요. 탭 제목에 '(완료)'로 알려드려요."
                    : "브라우저 알림을 보내고, 탭 제목에도 '(완료)'를 표시해요."}
                </span>
              </div>
            </div>
            {notification.permission === 'default' && (
              <Button variant="secondary" size="sm" className="h-10" onClick={notification.request}>
                알림 받기
              </Button>
            )}
          </section>
        )}

        {currentProgress.failedPhotos.length > 0 && (
          <section className="flex flex-col gap-3 rounded-lg border border-danger-border bg-background px-5 py-5 lg:px-6">
            <span className="text-small font-semibold text-danger">
              처리하지 못한 사진 {currentProgress.failedPhotos.length}장
            </span>
            <ul className="flex flex-col gap-2 text-small">
              {currentProgress.failedPhotos.map((failedPhoto) => (
                <li key={failedPhoto.photoId} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{failedPhoto.fileName}</span>
                  <span className="shrink-0 text-[13px] text-muted-foreground">
                    이 사진은 빼고 진행해요
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </AdministratorPageBody>

      <EventShareDialog
        isOpen={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        accessCode={currentProgress.accessCode}
      />
    </>
  )
}

// 지금 단계의 진행(얼굴 찾기: 막대 + 장 수 / 묶기: 진행 중 표시)과 다음 단계 안내
function ProcessingStatusCard({ progress }: { progress: EventProgress }) {
  const { status, photos } = progress
  const isExtracting = status === 'extracting'
  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border bg-background p-5 lg:p-6">
      {isExtracting ? (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-small">
            <span className="font-semibold">얼굴 찾는 중</span>
            <span role="status" className="font-semibold text-primary-hover">
              {photos.extracted} / {photos.total}장
            </span>
          </div>
          <Progress
            value={photos.total ? ((photos.extracted + photos.failed) / photos.total) * 100 : 0}
          />
          <span className="text-[13px] text-muted-foreground">
            지금 처리 중 {photos.processing}장
          </span>
        </div>
      ) : (
        <div role="status" className="flex items-center gap-3">
          <LoaderCircleIcon className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-small font-semibold">
            {status === 'clustering' ? '사람별로 묶는 중' : '공개하는 중'}
          </span>
          <span className="ml-auto text-[13px] text-muted-foreground">
            얼굴 찾기 완료 · {photos.extracted}장
          </span>
        </div>
      )}
      {isExtracting && (
        <NextStepRow title="사람별로 묶기" description="얼굴 찾기가 끝나면 자동으로 시작해요." />
      )}
      <NextStepRow title="공개" description="묶기가 끝나면 참가자에게 자동으로 공개돼요." />
      <p className="rounded-md bg-muted px-3.5 py-3 text-[13px] text-muted-foreground">
        창을 닫아도 서버에서 계속 진행돼요.
      </p>
    </section>
  )
}

function NextStepRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-small font-semibold">{title}</span>
        <span className="text-[13px] text-muted-foreground">{description}</span>
      </div>
      <span className="shrink-0 text-[13px] text-muted-foreground">대기 중</span>
    </div>
  )
}

// 브라우저 알림 권한. 지원하지 않는 브라우저(아이폰 사파리 탭 등)는 'unsupported'
function useCompletionNotificationPermission() {
  const isSupported = typeof Notification !== 'undefined'
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    isSupported ? Notification.permission : 'unsupported',
  )
  return {
    permission,
    request: () => {
      if (!isSupported) return
      void Notification.requestPermission().then(setPermission)
    },
  }
}
