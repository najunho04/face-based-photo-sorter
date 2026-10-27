import type {
  CreatedEvent,
  EventProgress,
  PhotoUploadResult,
  UploadCompletion,
} from '@/entities/event/event-types'
import { requestApi } from '@/shared/api/client'

/** 사진 업로드는 여러 장을 한 번에 보내므로 기본 대기 시간보다 길게 기다린다 */
const uploadTimeoutMilliseconds = 60_000

// #2 행사 생성: 이름을 보내면 인증코드가 발급된다(프론트가 이 코드로 QR을 그림)
export function createEvent(name: string): Promise<CreatedEvent> {
  return requestApi<CreatedEvent>('/api/admin/events', {
    method: 'POST',
    requester: 'administrator',
    jsonBody: { name },
  })
}

// #3 사진 업로드: multipart의 files 필드에 여러 장을 담아 보낸다
export function uploadEventPhotos({
  eventId,
  files,
  signal,
}: {
  eventId: number
  files: File[]
  signal?: AbortSignal
}): Promise<PhotoUploadResult> {
  const formData = new FormData()
  for (const file of files) formData.append('files', file, file.name)
  return requestApi<PhotoUploadResult>(`/api/admin/events/${eventId}/photos`, {
    method: 'POST',
    requester: 'administrator',
    formData,
    timeoutMilliseconds: uploadTimeoutMilliseconds,
    signal,
  })
}

// #4 업로드 완료: 서버가 얼굴 찾기를 시작하고 이후 업로드를 막는다
export function completeEventUpload(eventId: number): Promise<UploadCompletion> {
  return requestApi<UploadCompletion>(`/api/admin/events/${eventId}/upload-complete`, {
    method: 'POST',
    requester: 'administrator',
  })
}

// #5 진행 상황 조회: 상태·처리 장 수·실패 목록
export function getEventProgress(eventId: number, signal?: AbortSignal): Promise<EventProgress> {
  return requestApi<EventProgress>(`/api/admin/events/${eventId}`, {
    requester: 'administrator',
    signal,
  })
}
