import { http } from 'msw'
import type { EventProgress } from '@/entities/event/event-types'
import { mockAdministratorAccount } from '@/mocks/mock-accounts'
import {
  addMockUploadedFiles,
  completeMockUpload,
  createMockEvent,
  getMockEvent,
  toPhotoId,
  type MockEventSnapshot,
} from '@/mocks/mock-database'
import {
  applyServerConditions,
  authorizeRequest,
  failureResponse,
  readFormFiles,
  readJsonBody,
  successResponse,
  supportedImageTypes,
} from '@/mocks/mock-response'
import { createMockToken, mockTokenLifetimeSeconds } from '@/mocks/mock-tokens'

// 관리자 API 가짜 핸들러 (docs/api.md #1~#5). 주소 앞의 '*'는 어느 서버 주소로 보내든 받기 위해서다.

/** 업로드 파일 한 장의 최대 크기(가짜). 프론트가 2000px로 줄여 보내므로 넉넉하게 둔다 */
const maximumUploadFileBytes = 20 * 1024 * 1024

// 행사 상태를 #5 진행 상황 응답 모양으로 바꾼다
function toEventProgress(snapshot: MockEventSnapshot): EventProgress {
  return {
    eventId: snapshot.eventId,
    name: snapshot.name,
    accessCode: snapshot.accessCode,
    status: snapshot.status,
    photos: snapshot.photoCounts,
    personCount: snapshot.content?.persons.length ?? null,
    failedPhotos: snapshot.failedPhotos.map((failedPhoto) => ({
      photoId: toPhotoId(snapshot.eventId, failedPhoto.photoNumber),
      fileName: failedPhoto.fileName,
    })),
  }
}

export const administratorHandlers = [
  // #1 관리자 로그인
  http.post('*/api/admin/login', async ({ request }) => {
    const simulatedFailure = await applyServerConditions()
    if (simulatedFailure) return simulatedFailure

    const body = await readJsonBody(request)
    const loginId = body?.loginId
    const password = body?.password
    if (typeof loginId !== 'string' || typeof password !== 'string' || !loginId || !password) {
      return failureResponse('INVALID_REQUEST')
    }
    if (
      loginId !== mockAdministratorAccount.loginId ||
      password !== mockAdministratorAccount.password
    ) {
      return failureResponse('LOGIN_FAILED')
    }
    return successResponse({
      accessToken: createMockToken('admin', null),
      expiresIn: mockTokenLifetimeSeconds,
    })
  }),

  // #2 행사 생성
  http.post('*/api/admin/events', async ({ request }) => {
    const simulatedFailure = await applyServerConditions()
    if (simulatedFailure) return simulatedFailure
    const authorization = authorizeRequest(request, ['admin'])
    if (authorization.failure) return authorization.failure

    const body = await readJsonBody(request)
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (name.length === 0 || name.length > 50) return failureResponse('INVALID_REQUEST')

    const createdEvent = createMockEvent(name)
    return successResponse({
      eventId: createdEvent.eventId,
      name: createdEvent.name,
      accessCode: createdEvent.accessCode,
      status: createdEvent.status,
    })
  }),

  // #3 사진 업로드: 파일마다 형식·크기를 확인하고, 실패한 파일만 failed에 담는다
  http.post('*/api/admin/events/:eventId/photos', async ({ request, params }) => {
    const simulatedFailure = await applyServerConditions()
    if (simulatedFailure) return simulatedFailure
    const authorization = authorizeRequest(request, ['admin'])
    if (authorization.failure) return authorization.failure

    const event = getMockEvent(Number(params.eventId))
    if (!event) return failureResponse('EVENT_NOT_FOUND')
    if (event.status !== 'uploading') return failureResponse('INVALID_STATUS')

    const files = await readFormFiles(request, 'files')
    if (files.length === 0) return failureResponse('INVALID_REQUEST')

    const acceptedFileNames: string[] = []
    const failedFiles: Array<{ fileName: string; reason: string }> = []
    for (const file of files) {
      if (!supportedImageTypes.includes(file.type)) {
        failedFiles.push({ fileName: file.name, reason: 'UNSUPPORTED_FILE' })
      } else if (file.size > maximumUploadFileBytes) {
        failedFiles.push({ fileName: file.name, reason: 'FILE_TOO_LARGE' })
      } else {
        acceptedFileNames.push(file.name)
      }
    }
    addMockUploadedFiles(event.eventId, acceptedFileNames)
    return successResponse({ uploaded: acceptedFileNames.length, failed: failedFiles })
  }),

  // #4 업로드 완료: 이 시각부터 얼굴 찾기가 시작된 것으로 보고 상태가 시간에 따라 바뀐다
  http.post('*/api/admin/events/:eventId/upload-complete', async ({ request, params }) => {
    const simulatedFailure = await applyServerConditions()
    if (simulatedFailure) return simulatedFailure
    const authorization = authorizeRequest(request, ['admin'])
    if (authorization.failure) return authorization.failure

    const event = getMockEvent(Number(params.eventId))
    if (!event) return failureResponse('EVENT_NOT_FOUND')
    // 이미 완료했거나 올린 사진이 없으면 완료할 수 없다(사진 0장은 가짜 서버가 정한 규칙)
    if (event.status !== 'uploading' || event.photoCounts.total === 0) {
      return failureResponse('INVALID_STATUS')
    }

    completeMockUpload(event.eventId)
    return successResponse({
      eventId: event.eventId,
      status: 'extracting',
      totalPhotos: event.photoCounts.total,
    })
  }),

  // #5 진행 상황 조회
  http.get('*/api/admin/events/:eventId', async ({ request, params }) => {
    const simulatedFailure = await applyServerConditions()
    if (simulatedFailure) return simulatedFailure
    const authorization = authorizeRequest(request, ['admin'])
    if (authorization.failure) return authorization.failure

    const event = getMockEvent(Number(params.eventId))
    if (!event) return failureResponse('EVENT_NOT_FOUND')
    return successResponse(toEventProgress(event))
  }),
]
