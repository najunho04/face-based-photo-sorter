import type { EventStatus } from '@/entities/event/event-status'

// 행사 관련 API 요청·응답 타입 (docs/api.md #2~#5). 필드 이름은 서버 계약이라 그대로 쓴다.

/** #2 행사 생성 응답 */
export type CreatedEvent = {
  eventId: number
  name: string
  accessCode: string
  status: EventStatus
}

/** #3 사진 업로드 응답. 파일 단위 실패는 failed에 담기고 나머지는 성공 처리된다 */
export type PhotoUploadResult = {
  uploaded: number
  failed: Array<{ fileName: string; reason: string }>
}

/** #4 업로드 완료 응답 */
export type UploadCompletion = {
  eventId: number
  status: EventStatus
  totalPhotos: number
}

/** #5 진행 상황 조회 응답. 관리자 화면이 몇 초마다 다시 받는다 */
export type EventProgress = {
  eventId: number
  name: string
  accessCode: string
  status: EventStatus
  photos: {
    total: number
    extracted: number
    processing: number
    failed: number
  }
  /** 공개(open) 이후에만 값이 있다 */
  personCount: number | null
  failedPhotos: Array<{ photoId: number; fileName: string }>
}
