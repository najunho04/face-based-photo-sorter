import { queryOptions } from '@tanstack/react-query'
import { getEventProgress } from '@/entities/event/event-api'
import { getProgressPollingInterval } from '@/entities/event/event-polling'
import { eventQueryKeys } from '@/entities/event/event-query-keys'

// #5 진행 상황 조회 설정. 정리 중인 화면(A5)은 3초마다, 최근 행사 목록(A2)은 10초마다 다시 받되
// 서버가 정리하는 중일 때만 받는다(getProgressPollingInterval)
export function eventProgressQueryOptions(
  eventId: number,
  {
    pollingMilliseconds,
    pollsInBackground = false,
  }: {
    pollingMilliseconds?: number
    /** 탭이 안 보이는 동안에도 받을지. A5만 켠다(다른 탭에 있어도 완료를 알리려고) */
    pollsInBackground?: boolean
  } = {},
) {
  return queryOptions({
    queryKey: eventQueryKeys.progress(eventId),
    queryFn: ({ signal }) => getEventProgress(eventId, signal),
    refetchInterval: (query) =>
      getProgressPollingInterval(query.state.data?.status, pollingMilliseconds),
    refetchIntervalInBackground: pollsInBackground,
    staleTime: 0,
  })
}
