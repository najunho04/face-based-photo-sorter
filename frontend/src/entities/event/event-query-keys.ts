// TanStack Query 캐시 열쇠. 행사 하나에 딸린 데이터는 모두 ['events', eventId]로 시작해서 한 번에 무효화할 수 있다
export const eventQueryKeys = {
  /** 행사 하나에 딸린 모든 데이터(진행 상황·사진·사람) */
  event: (eventId: number) => ['events', eventId] as const,
  /** #5 진행 상황 */
  progress: (eventId: number) => ['events', eventId, 'progress'] as const,
}
