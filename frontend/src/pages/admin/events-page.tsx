import { useQueries } from '@tanstack/react-query'
import { CalendarPlusIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { eventProgressQueryOptions } from '@/entities/event/event-queries'
import { EventStatusBadge } from '@/entities/event/event-status-badge'
import type { EventProgress } from '@/entities/event/event-types'
import { readRecentEventIds, removeRecentEvent } from '@/entities/event/recent-event-storage'
import {
  AdministratorPageBody,
  AdministratorPageHeader,
} from '@/pages/admin/administrator-page-header'
import { isApiErrorWithCode } from '@/shared/api/api-error'
import { paths } from '@/shared/config/paths'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { Progress } from '@/shared/ui/progress'
import { Skeleton } from '@/shared/ui/skeleton'

/** 정리 중인 행사는 목록에서도 이 간격으로 진행을 새로 받는다 */
const recentEventPollingMilliseconds = 10_000

// A2 최근 행사 · M1: 이 브라우저에서 만든 행사를 #5로 상태와 함께 보여 준다(관리자 행사 목록 API 없음)
export default function EventsPage() {
  const [recentEventIds, setRecentEventIds] = useState(readRecentEventIds)
  const progressQueries = useQueries({
    queries: recentEventIds.map((eventId) =>
      eventProgressQueryOptions(eventId, { pollingMilliseconds: recentEventPollingMilliseconds }),
    ),
  })

  function forgetEvent(eventId: number) {
    removeRecentEvent(eventId)
    setRecentEventIds(readRecentEventIds())
  }

  return (
    <>
      <AdministratorPageHeader
        title="최근 행사"
        spacingBelow={28}
        description="이 브라우저에서 만든 행사예요. 다른 기기에서 만든 행사는 보이지 않아요."
        actions={
          <Button asChild>
            <Link to={paths.administratorEventCreate}>
              <PlusIcon />새 행사 만들기
            </Link>
          </Button>
        }
      />
      <AdministratorPageBody>
        <p className="text-[13px] text-muted-foreground lg:hidden">이 기기에서 만든 행사예요.</p>
        {recentEventIds.length === 0 ? (
          <EmptyState
            icon={CalendarPlusIcon}
            title="아직 만든 행사가 없어요"
            description="행사를 만들면 인증코드와 QR을 받을 수 있어요."
            action={
              <Button asChild>
                <Link to={paths.administratorEventCreate}>새 행사 만들기</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 pb-24 lg:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] lg:gap-4 lg:pb-0">
            {/* 같은 줄 카드는 높이를 맞추고(카드 h-full), 휴대폰은 마지막 카드가 떠 있는 [새 행사] 버튼에 가리지 않게 아래를 띄운다 */}
            {recentEventIds.map((eventId, index) => {
              const progressQuery = progressQueries[index]
              return (
                <li key={eventId}>
                  {progressQuery?.data ? (
                    <EventCard progress={progressQuery.data} />
                  ) : isApiErrorWithCode(progressQuery?.error, 'EVENT_NOT_FOUND') ? (
                    <MissingEventCard onForget={() => forgetEvent(eventId)} />
                  ) : progressQuery?.isError ? (
                    <div className="rounded-lg border border-border bg-background p-5 text-small text-muted-foreground">
                      행사 정보를 불러오지 못했어요.{' '}
                      <button
                        type="button"
                        className="font-semibold text-primary underline underline-offset-4"
                        onClick={() => void progressQuery.refetch()}
                      >
                        다시 시도
                      </button>
                    </div>
                  ) : (
                    <Skeleton className="h-32 rounded-lg" />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </AdministratorPageBody>

      {/* M1 휴대폰: 오른쪽 아래 둥근 [새 행사] 버튼(시안: 아래 36px, 그림자 md) */}
      <Button
        asChild
        className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+36px)] h-14 rounded-full px-5.5 shadow-md lg:hidden"
      >
        <Link to={paths.administratorEventCreate}>
          <PlusIcon />새 행사
        </Link>
      </Button>
    </>
  )
}

// 상태에 맞는 화면으로 가는 행사 카드: 업로드 중 → A4, 정리 중 → A5, 공개 → A6
function EventCard({ progress }: { progress: EventProgress }) {
  const destination =
    progress.status === 'uploading'
      ? paths.administratorEventUpload(progress.eventId)
      : progress.status === 'open'
        ? paths.administratorEventResult(progress.eventId)
        : paths.administratorEventProcessing(progress.eventId)

  return (
    <Link
      to={destination}
      className="flex h-full flex-col gap-2.5 rounded-lg border border-border bg-background p-4.5 transition-colors outline-none hover:border-primary-border focus-visible:ring-2 focus-visible:ring-ring lg:gap-3.5 lg:p-5"
    >
      <EventStatusBadge status={progress.status} />
      <span className="text-[17px] leading-6 font-bold lg:text-lg">{progress.name}</span>
      <EventCardSummary progress={progress} />
    </Link>
  )
}

// 카드 아래 한 줄: 상태마다 다른 요약(시안 A2)
function EventCardSummary({ progress }: { progress: EventProgress }) {
  const { status, photos } = progress
  if (status === 'extracting') {
    return (
      <div className="flex flex-col gap-1.5">
        <Progress value={photos.total ? (photos.extracted / photos.total) * 100 : 0} />
        <span className="text-[13px] text-muted-foreground">
          {photos.extracted} / {photos.total}장
        </span>
      </div>
    )
  }
  const summary =
    status === 'open'
      ? `사람 ${progress.personCount ?? 0}명 · 인증코드 ${progress.accessCode}`
      : status === 'clustering'
        ? '얼굴 찾기 완료 · 곧 공개돼요'
        : `사진 ${photos.total}장 올림 · 업로드 완료 전`
  return <span className="text-[13px] text-muted-foreground">{summary}</span>
}

// 행사가 없어졌을 때(EVENT_NOT_FOUND): 목록에서 지울 수 있게 한다
function MissingEventCard({ onForget }: { onForget: () => void }) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border border-border bg-background p-5">
      <span className="text-small font-semibold">행사를 찾을 수 없어요</span>
      <span className="text-[13px] text-muted-foreground">삭제되었거나 다른 서버의 행사예요.</span>
      <Button variant="secondary" size="sm" className="self-start" onClick={onForget}>
        목록에서 지우기
      </Button>
    </div>
  )
}
