// 입장(#6) 요청의 캐시 열쇠. ①-0 자동 입장과 ①-1 상태 확인이 서로 다른 열쇠를 써서 섞이지 않게 한다
export const sessionQueryKeys = {
  /** ①-0 QR·주소로 자동 입장 */
  join: (accessCode: string) => ['event-join', accessCode] as const,
  /** ①-1 공개됐는지 15초마다 확인 */
  joinStatus: (accessCode: string) => ['event-join', accessCode, 'status'] as const,
}
