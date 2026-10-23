import { queryOptions } from '@tanstack/react-query'
import { getEventProgress } from '@/entities/event/event-api'
import { eventQueryKeys } from '@/entities/event/event-query-keys'

// #5 진행 상황 조회 설정. 정리 중인 화면(A5)은 3초마다, 최근 행사 목록(A2)은 정리 중인 행사만 10초마다 다시 받는다
export function eventProgressQueryOptions(eventId: number, pollingMilliseconds?: number) {
  return queryOptions({
    queryKey: eventQueryKeys.progress(eventId),
    queryFn: ({ signal }) => getEventProgress(eventId, signal),
    // 공개(open)되면 더는 바뀌지 않으므로 그만 받는다
    refetchInterval: (query) =>
      pollingMilliseconds && query.state.data?.status !== 'open' ? pollingMilliseconds : false,
    // 탭이 안 보이는 동안에도 계속 확인해야 완료 알림을 보낼 수 있다(A5)
    refetchIntervalInBackground: true,
    staleTime: 0,
  })
}
