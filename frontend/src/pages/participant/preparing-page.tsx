import { useQuery } from '@tanstack/react-query'
import { CheckIcon, LoaderCircleIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import type { EventStatus } from '@/entities/event/event-status'
import {
  saveJoinedEvent,
  useCurrentParticipantSession,
} from '@/entities/session/participant-session'
import { joinEvent } from '@/entities/session/session-api'
import { sessionQueryKeys } from '@/entities/session/session-query-keys'
import type { EntryPageState } from '@/pages/participant/entry-page'
import { isApiErrorWithCode } from '@/shared/api/api-error'
import { getErrorMessage } from '@/shared/api/error-messages'
import { paths } from '@/shared/config/paths'
import { cn } from '@/shared/lib/utils'
import { AppLogo } from '@/shared/ui/app-logo'
import { Button } from '@/shared/ui/button'

/** 공개됐는지 확인하는 간격(결정: 15초) */
const statusCheckIntervalMilliseconds = 15_000

// 정리 단계 순서와 이름(시안 ①-1). 서버 상태값의 순서와 같다
const preparationSteps: Array<{ status: EventStatus; label: string }> = [
  { status: 'uploading', label: '사진 올리기' },
  { status: 'extracting', label: '얼굴 찾기' },
  { status: 'clustering', label: '사람별로 묶기' },
  { status: 'open', label: '공개' },
]

// ①-1 사진 정리 중: 공개 전 행사에 입장했을 때. 15초마다 입장(#6)을 다시 불러 상태를 확인하고,
// 공개되면 ② 사람별 사진으로 넘어간다. 탭이 안 보이는 동안에는 확인을 멈춘다
export default function PreparingPage() {
  const navigate = useNavigate()
  const session = useCurrentParticipantSession()

  const statusQuery = useQuery({
    queryKey: sessionQueryKeys.joinStatus(session.accessCode),
    queryFn: () => joinEvent(session.accessCode),
    refetchInterval: statusCheckIntervalMilliseconds,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
  })

  // 확인할 때마다 새 토큰·공개 여부를 저장하고, 공개됐으면 바로 넘어간다
  useEffect(() => {
    if (!statusQuery.data) return
    const updatedSession = saveJoinedEvent(statusQuery.data, session.accessCode)
    if (updatedSession.isEventOpen) {
      void navigate(paths.eventHome(session.accessCode), { replace: true })
    }
  }, [statusQuery.data, session.accessCode, navigate])

  // 그사이 행사가 없어졌으면(코드가 더는 안 맞음) 입장 화면으로 보낸다
  const isInvalidCode = isApiErrorWithCode(statusQuery.error, 'INVALID_ACCESS_CODE')
  useEffect(() => {
    if (!isInvalidCode) return
    const entryState: EntryPageState = { errorMessage: getErrorMessage(statusQuery.error) }
    void navigate(paths.entry, { replace: true, state: entryState })
  }, [isInvalidCode, statusQuery.error, navigate])

  const currentStepIndex = preparationSteps.findIndex(
    (step) => step.status === statusQuery.data?.status,
  )

  return (
    <div className="flex flex-1 flex-col px-6 pt-[calc(env(safe-area-inset-top)+40px)] pb-[calc(env(safe-area-inset-bottom)+24px)] lg:mx-auto lg:w-full lg:max-w-[480px] lg:py-16">
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <AppLogo size="medium" />
        <span className="truncate rounded-full bg-secondary px-2.5 py-1 text-caption text-secondary-foreground">
          {session.eventName}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-7 py-8">
        <div className="flex size-18 items-center justify-center rounded-full bg-secondary">
          <LoaderCircleIcon className="size-8 animate-spin text-primary" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-title-1">사진을 정리하고 있어요</h1>
          <p className="text-[15px] leading-6 text-muted-foreground">
            행사 사진에서 얼굴을 찾아 사람별로 묶는 중이에요. 잠시 후 다시 확인해주세요.
          </p>
        </div>
        <ol className="flex flex-col gap-3.5 rounded-lg bg-muted p-4" aria-label="정리 단계">
          {preparationSteps.map((step, stepIndex) => (
            <PreparationStepItem
              key={step.status}
              label={step.label}
              state={
                currentStepIndex === -1 || stepIndex > currentStepIndex
                  ? 'waiting'
                  : stepIndex < currentStepIndex
                    ? 'done'
                    : 'current'
              }
            />
          ))}
        </ol>
      </div>

      <div
        role="status"
        className="flex items-center gap-2.5 rounded-md bg-muted px-4 py-3 text-small text-muted-foreground"
      >
        <LoaderCircleIcon
          className="size-4.5 shrink-0 animate-spin text-primary"
          aria-hidden="true"
        />
        {statusQuery.isError && !isInvalidCode
          ? '확인하지 못했어요. 잠시 후 자동으로 다시 확인해요.'
          : '자동으로 확인하고 있어요. 공개되면 바로 넘어가요.'}
      </div>
      <Button
        variant="secondary"
        className="mt-3 h-12"
        loading={statusQuery.isFetching}
        onClick={() => void statusQuery.refetch()}
      >
        지금 확인하기
      </Button>
    </div>
  )
}

// 정리 단계 한 줄: 끝남(초록 체크) · 진행 중(인디고 점 + "진행 중") · 기다림(회색 테두리)
function PreparationStepItem({
  label,
  state,
}: {
  label: string
  state: 'done' | 'current' | 'waiting'
}) {
  return (
    <li className="flex items-center gap-3 text-[15px]">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full',
          state === 'done' && 'bg-success text-white',
          state === 'current' && 'border-2 border-primary',
          state === 'waiting' && 'border-2 border-input',
        )}
      >
        {state === 'done' && <CheckIcon className="size-3.5" strokeWidth={3} />}
        {state === 'current' && <span className="size-2.5 rounded-full bg-primary" />}
      </span>
      <span className={cn(state === 'current' ? 'font-semibold' : 'text-muted-foreground')}>
        {label}
        <span className="sr-only">
          {state === 'done' ? ' 끝남' : state === 'current' ? ' 진행 중' : ' 기다리는 중'}
        </span>
      </span>
      {state === 'current' && (
        <span aria-hidden="true" className="ml-auto text-caption text-primary-hover">
          진행 중
        </span>
      )}
    </li>
  )
}
