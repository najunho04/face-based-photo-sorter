// 화면 주소를 한곳에서 만든다. 주소 모양이 바뀌어도 여기만 고치면 되도록 화면에서는 문자열을 직접 쓰지 않는다.

// 인증코드는 주소 한 칸에 들어가므로 특수문자를 안전하게 바꾼다
function encodeSegment(value: string | number): string {
  return encodeURIComponent(String(value))
}

export const paths = {
  /** ① 입장 */
  entry: '/',
  /** ⑧ 입장 시간 만료. 코드를 알면 [다시 입장하기]가 바로 재입장한다 */
  sessionExpired: (accessCode?: string) =>
    accessCode ? `/expired?code=${encodeSegment(accessCode)}` : '/expired',

  /** ①-0 QR로 입장 중. next가 있으면 입장 뒤 그 화면으로 돌아간다 */
  eventJoin: (accessCode: string, nextPath?: string) =>
    `/e/${encodeSegment(accessCode)}${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''}`,
  /** ①-1 사진 정리 중 */
  eventPreparing: (accessCode: string) => `/e/${encodeSegment(accessCode)}/preparing`,
  /** ② 사람별 사진 */
  eventHome: (accessCode: string) => `/e/${encodeSegment(accessCode)}/home`,
  /** ⑦ 전체 사진 */
  eventAllPhotos: (accessCode: string) => `/e/${encodeSegment(accessCode)}/all`,
  /** ②-1 동의 · ③ 셀카 촬영 · ③-1 찾는 중 */
  eventCamera: (accessCode: string) => `/e/${encodeSegment(accessCode)}/camera`,
  /** ④ 후보 선택 */
  eventCandidates: (accessCode: string) => `/e/${encodeSegment(accessCode)}/candidates`,
  /** ⑤ 고른 사람들의 사진 합쳐 보기 */
  eventPhotos: (accessCode: string, personIds: number[]) =>
    `/e/${encodeSegment(accessCode)}/photos?persons=${personIds.join(',')}`,
  /** ⑥ 사진 크게 보기 */
  eventPhoto: (accessCode: string, photoId: number) =>
    `/e/${encodeSegment(accessCode)}/photos/${encodeSegment(photoId)}`,

  /** A1 관리자 로그인. next가 있으면 로그인 뒤 그 화면으로 돌아간다 */
  administratorLogin: (nextPath?: string) =>
    `/admin/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''}`,
  /** A2 최근 행사 */
  administratorEvents: '/admin/events',
  /** A3 새 행사 만들기 */
  administratorEventCreate: '/admin/events/new',
  /** A4 사진 올리기 */
  administratorEventUpload: (eventId: number) => `/admin/events/${encodeSegment(eventId)}/upload`,
  /** A5 사진 정리 중 */
  administratorEventProcessing: (eventId: number) =>
    `/admin/events/${encodeSegment(eventId)}/processing`,
  /** A6 분류 결과 */
  administratorEventResult: (eventId: number) => `/admin/events/${encodeSegment(eventId)}/result`,
  /** A7 사람 폴더 사진 */
  administratorPersonPhotos: (eventId: number, personId: number) =>
    `/admin/events/${encodeSegment(eventId)}/persons/${encodeSegment(personId)}`,
} as const
