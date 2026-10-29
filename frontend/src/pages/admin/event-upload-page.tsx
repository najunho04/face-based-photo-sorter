import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImageIcon, MonitorIcon, QrCodeIcon } from 'lucide-react'
import { useEffect, useId, useState, type ChangeEvent } from 'react'
import { Navigate, useBlocker, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { completeEventUpload } from '@/entities/event/event-api'
import { EventProgressSteps } from '@/entities/event/event-progress-steps'
import { eventQueryKeys } from '@/entities/event/event-query-keys'
import { eventProgressQueryOptions } from '@/entities/event/event-queries'
import { EventShareDialog } from '@/features/publish/event-share-dialog'
import {
  getUploadFailureLabel,
  isRetryableUploadFailure,
  summarizeUploadFailureReasons,
} from '@/features/upload/upload-failure-reasons'
import { UploadDropzone } from '@/features/upload/upload-dropzone'
import { useUploadQueue } from '@/features/upload/use-upload-queue'
import {
  AdministratorPageBody,
  AdministratorPageHeader,
} from '@/pages/admin/administrator-page-header'
import { getErrorMessage } from '@/shared/api/error-messages'
import { paths } from '@/shared/config/paths'
import { observeToastClearance } from '@/shared/lib/toast-clearance'
import { cn } from '@/shared/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Button } from '@/shared/ui/button'
import { buttonVariants } from '@/shared/ui/button-variants'
import { ErrorState } from '@/shared/ui/error-state'
import { Progress } from '@/shared/ui/progress'
import { Skeleton } from '@/shared/ui/skeleton'

// A4 사진 올리기 · A4-1 업로드 완료 확인 (PC A4, 휴대폰 M2).
// 고른 사진을 줄여서 차례로 올리고, 다 올리면 [업로드 완료] → 확인 창 → #4 → A5 정리 중으로 간다
export default function EventUploadPage() {
  const eventId = Number(useParams().eventId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const progressQuery = useQuery(eventProgressQueryOptions(eventId))
  const upload = useUploadQueue(eventId)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false)
  const completeMutation = useMutation({ mutationFn: completeEventUpload })
  const galleryInputId = useId()
  const { snapshot } = upload
  const isUploading = snapshot.remainingCount > 0

  // 한 묶음씩 끝날 때마다 서버의 올린 장 수(#5)를 새로 받는다
  const { refetch: refetchProgress } = progressQuery
  useEffect(() => {
    if (snapshot.doneCount > 0) void refetchProgress()
  }, [snapshot.doneCount, refetchProgress])

  // 올리는 중에 창을 닫거나 새로고침하면 브라우저 경고를 띄운다
  useEffect(() => {
    if (!isUploading) return
    const warnBeforeUnload = (unloadEvent: BeforeUnloadEvent) => unloadEvent.preventDefault()
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [isUploading])
  // 올리는 중에 다른 화면으로 가려 하면 확인한다
  const leaveBlocker = useBlocker(isUploading && !completeMutation.isSuccess)

  if (progressQuery.isPending) {
    return (
      <AdministratorPageBody>
        <Skeleton className="h-40 rounded-lg" />
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
  // 이미 업로드를 완료한 행사는 정리 중 화면으로 보낸다
  if (progress.status !== 'uploading' && !completeMutation.isPending) {
    return <Navigate to={paths.administratorEventProcessing(eventId)} replace />
  }

  const serverPhotoCount = progress.photos.total
  const failedItems = snapshot.items.filter((item) => item.status === 'failed')
  const hasRetryableFailure = failedItems.some((item) =>
    isRetryableUploadFailure(item.failureReason),
  )
  // 이번에 고른 사진을 다 보냈는지(실패한 사진은 끝난 것으로 본다)
  const hasFinishedUploading = !isUploading && snapshot.totalCount > 0

  function addFiles(files: File[]) {
    const addedCount = upload.addFiles(files)
    if (files.length > 0 && addedCount === 0) toast('이미 고른 사진이거나 사진 파일이 아니에요')
  }

  function handleGalleryChange(changeEvent: ChangeEvent<HTMLInputElement>) {
    const files = [...(changeEvent.target.files ?? [])]
    changeEvent.target.value = ''
    addFiles(files)
  }

  // [업로드 완료]: 올리는 중이거나 올린 사진이 없으면 이유를 알려 주고, 아니면 확인 창(A4-1)을 연다
  function requestCompletion() {
    if (isUploading) {
      toast('업로드가 끝난 뒤에 완료할 수 있어요')
      return
    }
    if (serverPhotoCount === 0) {
      toast('사진을 먼저 올려주세요')
      return
    }
    setIsCompleteDialogOpen(true)
  }

  async function confirmCompletion() {
    try {
      await completeMutation.mutateAsync(eventId)
      await queryClient.invalidateQueries({ queryKey: eventQueryKeys.event(eventId) })
      void navigate(paths.administratorEventProcessing(eventId), { replace: true })
    } catch (error) {
      setIsCompleteDialogOpen(false)
      toast.error(getErrorMessage(error))
    }
  }

  const shareButton = (
    <Button variant="secondary" size="md" onClick={() => setIsShareDialogOpen(true)}>
      <QrCodeIcon />
      인증코드·QR 보기
    </Button>
  )
  const completeButton = (
    <Button
      size="lg"
      className={cn(
        'lg:h-11 lg:px-5 lg:text-[15px]',
        (isUploading || serverPhotoCount === 0) &&
          'bg-border text-muted-foreground hover:bg-border',
      )}
      aria-disabled={isUploading || serverPhotoCount === 0}
      onClick={requestCompletion}
    >
      업로드 완료
    </Button>
  )

  return (
    <>
      <AdministratorPageHeader
        title="사진 올리기"
        eventName={progress.name}
        backTo={paths.administratorEvents}
        breadcrumbs={[
          { label: '최근 행사', to: paths.administratorEvents },
          { label: progress.name },
        ]}
        actions={shareButton}
      />
      <AdministratorPageBody>
        <div className="hidden lg:block">
          <EventProgressSteps status="uploading" />
        </div>
        <div className="hidden lg:block">
          <UploadDropzone
            onFiles={addFiles}
            hasPhotos={serverPhotoCount + snapshot.totalCount > 0}
          />
        </div>

        {/* 진행 상자(시안 A4·A4-1·M2): 올리는 중엔 "64 / 100장", 다 올리면 "업로드 끝 · 98장 올림 · 실패 2장" */}
        <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-background p-5 lg:p-6">
          <div className="flex justify-between text-small">
            <span className="font-semibold">{hasFinishedUploading ? '업로드 끝' : '업로드'}</span>
            <span role="status" className="font-semibold text-success">
              {snapshot.totalCount === 0
                ? `이 행사에 올린 사진 ${serverPhotoCount}장`
                : hasFinishedUploading
                  ? `${snapshot.doneCount}장 올림${failedItems.length > 0 ? ` · 실패 ${failedItems.length}장` : ''}`
                  : `${snapshot.doneCount} / ${snapshot.totalCount}장`}
            </span>
          </div>
          <Progress
            tone="success"
            value={
              snapshot.totalCount > 0
                ? (snapshot.doneCount / snapshot.totalCount) * 100
                : serverPhotoCount > 0
                  ? 100
                  : 0
            }
          />
          <p className="text-[13px] leading-6 text-muted-foreground">
            {isUploading
              ? '사진 크기를 줄여서 올리고 있어요. 업로드 중에는 이 창을 닫지 마세요.'
              : snapshot.totalCount > 0
                ? failedItems.length > 0
                  ? '업로드가 끝났어요. 실패한 사진은 다시 시도하거나 빼고 진행할 수 있어요.'
                  : `업로드가 끝났어요. 이 행사에 올린 사진은 모두 ${serverPhotoCount}장이에요.`
                : serverPhotoCount > 0
                  ? '사진을 더 올리거나 업로드를 완료하세요.'
                  : '행사 사진을 골라 올려주세요.'}
          </p>
        </section>

        {/* 휴대폰(M2) 실패 상자: 좁은 화면이라 파일 목록 대신 이유별 장 수 한 줄 + [다시 시도] */}
        {failedItems.length > 0 && (
          <section className="flex items-center justify-between gap-3 rounded-lg border border-danger-border bg-background px-5 py-4 lg:hidden">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-small font-semibold text-danger">
                {failedItems.length}장 업로드 실패
              </span>
              <span className="text-caption text-muted-foreground">
                {summarizeUploadFailureReasons(failedItems.map((item) => item.failureReason))}
              </span>
            </div>
            {hasRetryableFailure && (
              <Button
                variant="secondary"
                size="md"
                className="text-[13px]"
                onClick={upload.retryFailed}
              >
                다시 시도
              </Button>
            )}
          </section>
        )}

        {/* PC(A4) 실패 상자: 파일별 이유와 제외 여부 */}
        {failedItems.length > 0 && (
          <section className="hidden flex-col gap-3 rounded-lg border border-danger-border bg-background px-6 py-5 lg:flex">
            <div className="flex items-center justify-between gap-3">
              <span className="text-small font-semibold text-danger">
                업로드하지 못한 사진 {failedItems.length}장
              </span>
              {hasRetryableFailure && (
                <Button variant="secondary" size="sm" onClick={upload.retryFailed}>
                  다시 시도
                </Button>
              )}
            </div>
            <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto text-small">
              {failedItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {item.fileName}{' '}
                    <span className="text-muted-foreground">
                      · {getUploadFailureLabel(item.failureReason)}
                    </span>
                  </span>
                  {!isRetryableUploadFailure(item.failureReason) && (
                    <span className="shrink-0 text-[13px] text-muted-foreground">제외됨</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 휴대폰(M2): PC가 더 빠르다는 안내 */}
        <div className="flex items-start gap-2.5 rounded-md border border-border bg-background px-4 py-3.5 lg:hidden">
          <MonitorIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="text-[13px] leading-6 text-muted-foreground">
            사진이 많으면 PC에서 올리는 게 더 빠르고 안정적이에요.
          </span>
        </div>

        {/* PC: 완료 안내 + 버튼 */}
        <section className="hidden flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-background px-6 py-5 lg:flex">
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold">
              {isUploading
                ? '업로드가 끝나면 완료할 수 있어요'
                : '다 올렸으면 업로드 완료를 눌러주세요'}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {isUploading && `남은 사진 ${snapshot.remainingCount}장 · `}
              완료하면 얼굴 찾기가 시작되고, 사진을 더 추가할 수 없어요.
            </span>
          </div>
          {completeButton}
        </section>
        {/* 휴대폰 아래 고정 막대 자리만큼 띄운다 */}
        <div className="h-48 lg:hidden" />
      </AdministratorPageBody>

      {/* 휴대폰(M2) 아래 고정 막대: 갤러리에서 더 고르기 + 업로드 완료. 토스트는 이 막대 위에 뜬다 */}
      <div
        ref={observeToastClearance}
        className="fixed inset-x-0 bottom-0 flex flex-col gap-2.5 border-t border-border bg-background px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+32px)] lg:hidden"
      >
        <label
          htmlFor={galleryInputId}
          className={cn(buttonVariants({ variant: 'secondary' }), 'h-12 cursor-pointer')}
        >
          <ImageIcon aria-hidden="true" />
          갤러리에서 사진 {serverPhotoCount + snapshot.totalCount > 0 ? '더 ' : ''}고르기
          <input
            id={galleryInputId}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/heic,image/heif"
            className="sr-only"
            onChange={handleGalleryChange}
          />
        </label>
        {completeButton}
        <span className="text-center text-caption text-muted-foreground">
          {failedItems.length > 0 && `실패한 ${failedItems.length}장은 빼고 진행돼요 · `}
          완료하면 사진을 더 추가할 수 없어요
        </span>
      </div>

      <EventShareDialog
        isOpen={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        accessCode={progress.accessCode}
      />

      {/* A4-1 업로드 완료 확인 */}
      <AlertDialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>업로드를 완료할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              올린 사진 {serverPhotoCount}장으로 얼굴 찾기를 시작해요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="rounded-md bg-warning-soft px-3.5 py-3 text-small leading-6 text-warning">
            {failedItems.length > 0 && `실패한 ${failedItems.length}장은 빠지고, `}
            완료하면 사진을 더 추가할 수 없어요.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(clickEvent) => {
                // 확인 창이 바로 닫히지 않게 하고, 요청이 끝나면 화면을 옮긴다
                clickEvent.preventDefault()
                void confirmCompletion()
              }}
              disabled={completeMutation.isPending}
            >
              완료하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 올리는 중에 나가려 할 때 */}
      <AlertDialog open={leaveBlocker.state === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>업로드를 멈추고 나갈까요?</AlertDialogTitle>
            <AlertDialogDescription>
              아직 올리지 못한 사진 {snapshot.remainingCount}장은 다시 골라야 해요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => leaveBlocker.reset?.()}>
              계속 올리기
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => leaveBlocker.proceed?.()}>나가기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
