import type { EventStatus } from '@/entities/event/event-status'

/** 서버가 스스로 다음 단계로 넘기는 상태(워커가 얼굴을 찾고, 다 찾으면 묶는다) */
const serverProcessingStatuses: ReadonlySet<EventStatus> = new Set(['extracting', 'clustering'])

// #5 진행 상황을 다시 받을 간격. 서버가 정리하는 중일 때만 다시 받는다.
// 업로드 중은 관리자가 [업로드 완료]를 누르기 전에는, 공개 중은 그 뒤로 바뀌지 않으므로 받지 않는다
export function getProgressPollingInterval(
  status: EventStatus | undefined,
  pollingMilliseconds: number | undefined,
): number | false {
  if (!pollingMilliseconds || !status) return false
  return serverProcessingStatuses.has(status) ? pollingMilliseconds : false
}
