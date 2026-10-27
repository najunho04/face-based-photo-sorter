import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  completeEventUpload,
  createEvent,
  getEventProgress,
  uploadEventPhotos,
} from '@/entities/event/event-api'
import { getPersonPhotos, getPersons, matchSelfie } from '@/entities/person/person-api'
import { getEventPhotoPage } from '@/entities/photo/photo-api'
import { joinEvent, loginAdministrator } from '@/entities/session/session-api'
import { mockAdministratorAccount, mockSampleAccessCodes } from '@/mocks/mock-accounts'
import { resetMockDatabase } from '@/mocks/mock-database'
import { resetMockSettings, updateMockSettings } from '@/mocks/mock-settings'
import { mockHandlers } from '@/mocks/handlers'
import { ApiError } from '@/shared/api/api-error'
import {
  clearAllSessions,
  saveAdministratorSession,
  saveParticipantSession,
} from '@/shared/api/token-storage'

// 화면 없이 실제 호출 함수(entities)로 가짜 API를 불러, 응답이 docs/api.md 형식과 같은지 확인한다
const server = setupServer(...mockHandlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  clearAllSessions()
  resetMockDatabase()
  resetMockSettings()
  vi.useRealTimers()
})
afterAll(() => server.close())

// 관리자로 로그인해 토큰을 저장한다
async function signInAsAdministrator() {
  const login = await loginAdministrator(mockAdministratorAccount)
  saveAdministratorSession({
    accessToken: login.accessToken,
    expiresInSeconds: login.expiresIn,
    loginId: mockAdministratorAccount.loginId,
  })
}

// 인증코드로 입장해 참가자 토큰을 저장하고 행사 번호를 돌려준다
async function joinAsParticipant(accessCode: string) {
  const join = await joinEvent(accessCode)
  saveParticipantSession({
    accessToken: join.accessToken,
    eventId: join.eventId,
    eventName: join.eventName,
    accessCode,
    isEventOpen: join.status === 'open',
  })
  return join
}

// 실패해야 하는 호출에서 ApiError를 꺼낸다
async function catchApiError(request: Promise<unknown>): Promise<ApiError> {
  const error = await request.catch((caught: unknown) => caught)
  if (!(error instanceof ApiError)) throw new Error(`ApiError가 아님: ${String(error)}`)
  return error
}

describe('#1 관리자 로그인', () => {
  it('테스트 계정이면 토큰과 만료 시간(초)을 준다(실제 백엔드와 같은 12시간)', async () => {
    const login = await loginAdministrator(mockAdministratorAccount)

    expect(login.accessToken).toEqual(expect.any(String))
    expect(login.expiresIn).toBe(43200)
  })

  it('비밀번호가 다르면 LOGIN_FAILED(401)', async () => {
    const error = await catchApiError(
      loginAdministrator({ loginId: mockAdministratorAccount.loginId, password: 'wrong' }),
    )

    expect(error).toMatchObject({ code: 'LOGIN_FAILED', status: 401 })
  })
})

describe('#2~#5 행사 만들기 → 업로드 → 완료 → 진행 상황', () => {
  it('처음부터 공개까지 이어진다', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-23T10:00:00Z') })
    await signInAsAdministrator()

    const createdEvent = await createEvent('테스트 행사')
    expect(createdEvent).toMatchObject({ name: '테스트 행사', status: 'uploading' })
    expect(createdEvent.accessCode).toMatch(/^[A-Z0-9]{6}$/)

    const files = Array.from(
      { length: 20 },
      (_, index) =>
        new File(['jpg'], `IMG_${String(index + 1).padStart(4, '0')}.jpg`, { type: 'image/jpeg' }),
    )
    const heicFile = new File(['heic'], 'IMG_9999.heic', { type: 'image/heic' })
    const uploadResult = await uploadEventPhotos({
      eventId: createdEvent.eventId,
      files: [...files, heicFile],
    })
    expect(uploadResult).toEqual({
      uploaded: 20,
      failed: [{ fileName: 'IMG_9999.heic', reason: 'UNSUPPORTED_FILE' }],
    })

    const completion = await completeEventUpload(createdEvent.eventId)
    expect(completion).toEqual({
      eventId: createdEvent.eventId,
      status: 'extracting',
      totalPhotos: 20,
    })

    const progressWhileExtracting = await getEventProgress(createdEvent.eventId)
    expect(progressWhileExtracting).toMatchObject({ status: 'extracting', personCount: null })
    expect(progressWhileExtracting.photos.total).toBe(20)

    // 완료 후 충분히 시간이 지나면 공개된다(얼굴 찾기 → 묶기 → 공개)
    vi.setSystemTime(new Date('2026-10-23T10:10:00Z'))
    const progressWhenOpen = await getEventProgress(createdEvent.eventId)
    expect(progressWhenOpen.status).toBe('open')
    expect(progressWhenOpen.personCount).toBeGreaterThan(0)
    expect(progressWhenOpen.photos).toEqual({ total: 20, extracted: 19, processing: 0, failed: 1 })
    expect(progressWhenOpen.failedPhotos).toEqual([
      { photoId: expect.any(Number), fileName: 'IMG_0013.jpg' },
    ])
  })

  it('완료한 행사에 다시 업로드하면 INVALID_STATUS(409)', async () => {
    await signInAsAdministrator()

    const error = await catchApiError(
      uploadEventPhotos({
        eventId: 1,
        files: [new File(['jpg'], 'late.jpg', { type: 'image/jpeg' })],
      }),
    )

    expect(error).toMatchObject({ code: 'INVALID_STATUS', status: 409 })
  })

  it('없는 행사는 EVENT_NOT_FOUND(404)', async () => {
    await signInAsAdministrator()

    const error = await catchApiError(getEventProgress(999_999))

    expect(error).toMatchObject({ code: 'EVENT_NOT_FOUND', status: 404 })
  })

  it('토큰 없이 부르면 UNAUTHORIZED(401)', async () => {
    const error = await catchApiError(createEvent('토큰 없음'))

    expect(error).toMatchObject({ code: 'UNAUTHORIZED', status: 401 })
  })
})

describe('#6 참가자 입장', () => {
  it('공개된 행사 코드로 입장한다', async () => {
    const join = await joinEvent(mockSampleAccessCodes.open)

    expect(join).toMatchObject({ eventId: 1, eventName: '2026 가을 축제', status: 'open' })
  })

  it('정리 중인 행사 코드도 입장은 되고 상태로 알려 준다', async () => {
    const join = await joinEvent(mockSampleAccessCodes.extracting)

    expect(join.status).toBe('extracting')
  })

  it('없는 코드는 INVALID_ACCESS_CODE(404)', async () => {
    const error = await catchApiError(joinEvent('ZZZZZZ'))

    expect(error).toMatchObject({ code: 'INVALID_ACCESS_CODE', status: 404 })
  })
})

describe('#10·#9 사람 폴더 (공개된 샘플 행사: 사진 100장, 사람 48명 중 한 장에만 나온 8명)', () => {
  it('minPhotos=2면 40명이 사진 수 많은 순으로 온다', async () => {
    await joinAsParticipant(mockSampleAccessCodes.open)

    const personList = await getPersons({ eventId: 1, minPhotos: 2, requester: 'participant' })

    expect(personList.total).toBe(40)
    expect(personList.persons).toHaveLength(40)
    const photoCounts = personList.persons.map((person) => person.photoCount)
    expect(photoCounts).toEqual([...photoCounts].sort((first, second) => second - first))
    expect(personList.persons[0]).toMatchObject({
      personId: expect.any(Number),
      label: expect.stringMatching(/^user\d+$/),
      repFace: {
        url: expect.any(String),
        bbox: {
          x: expect.any(Number),
          y: expect.any(Number),
          w: expect.any(Number),
          h: expect.any(Number),
        },
      },
    })
  })

  it('대표 얼굴 비우기 설정: 주소 없음이면 url이 null, 얼굴 없음이면 repFace가 null(매칭 PR 백엔드처럼)', async () => {
    await joinAsParticipant(mockSampleAccessCodes.open)

    updateMockSettings({ representativeFaceMode: 'missing-url' })
    const withoutUrl = await getPersons({ eventId: 1, minPhotos: 2, requester: 'participant' })
    updateMockSettings({ representativeFaceMode: 'missing-face' })
    const withoutFace = await getPersons({ eventId: 1, minPhotos: 2, requester: 'participant' })
    const match = await matchSelfie({
      eventId: 1,
      selfie: new Blob(['jpg'], { type: 'image/jpeg' }),
    })

    expect(withoutUrl.persons[0].repFace).toEqual({ url: null, bbox: expect.any(Object) })
    expect(withoutFace.persons[0].repFace).toBeNull()
    expect(match.candidates[0].repFace).toBeNull()
  })

  it('minPhotos 없이 부르면 48명 모두 온다', async () => {
    await joinAsParticipant(mockSampleAccessCodes.open)

    const personList = await getPersons({ eventId: 1, requester: 'participant' })

    expect(personList.total).toBe(48)
  })

  it('폴더 사진은 사진 수만큼 오고 저장 주소와 만료 시간이 있다', async () => {
    await joinAsParticipant(mockSampleAccessCodes.open)
    const [firstPerson] = (await getPersons({ eventId: 1, requester: 'participant' })).persons

    const personPhotos = await getPersonPhotos({
      eventId: 1,
      personId: firstPerson.personId,
      requester: 'participant',
    })

    expect(personPhotos.total).toBe(firstPerson.photoCount)
    expect(personPhotos.photos).toHaveLength(firstPerson.photoCount)
    expect(personPhotos.photos[0]).toMatchObject({
      photoId: expect.any(Number),
      fileName: expect.stringMatching(/\.jpg$/),
      url: expect.any(String),
      downloadUrl: expect.stringContaining('attachment'),
      expiresIn: 3600,
    })
  })

  it('관리자 토큰으로도 부를 수 있다', async () => {
    await signInAsAdministrator()

    const personList = await getPersons({ eventId: 1, minPhotos: 2, requester: 'administrator' })

    expect(personList.total).toBe(40)
  })

  it('없는 사람은 PERSON_NOT_FOUND(404)', async () => {
    await joinAsParticipant(mockSampleAccessCodes.open)

    const error = await catchApiError(
      getPersonPhotos({ eventId: 1, personId: 999_999, requester: 'participant' }),
    )

    expect(error).toMatchObject({ code: 'PERSON_NOT_FOUND', status: 404 })
  })

  it('정리 중인 행사는 EVENT_NOT_READY(409)', async () => {
    const join = await joinAsParticipant(mockSampleAccessCodes.extracting)

    const error = await catchApiError(
      getPersons({ eventId: join.eventId, requester: 'participant' }),
    )

    expect(error).toMatchObject({ code: 'EVENT_NOT_READY', status: 409 })
  })

  it('다른 행사의 참가자 토큰이면 FORBIDDEN(403)', async () => {
    await joinAsParticipant(mockSampleAccessCodes.open)

    const error = await catchApiError(getPersons({ eventId: 3, requester: 'participant' }))

    expect(error).toMatchObject({ code: 'FORBIDDEN', status: 403 })
  })
})

describe('#7 전체 사진', () => {
  it('30장씩 페이지로 나눠 준다', async () => {
    await joinAsParticipant(mockSampleAccessCodes.open)

    const firstPage = await getEventPhotoPage({ eventId: 1, page: 1 })
    const lastPage = await getEventPhotoPage({ eventId: 1, page: 4 })

    expect(firstPage).toMatchObject({ page: 1, size: 30, total: 100 })
    expect(firstPage.photos).toHaveLength(30)
    expect(lastPage.photos).toHaveLength(10)
  })
})

describe('#8 셀카 검색 (오류 재현 패널의 결과 설정)', () => {
  const selfie = new File(['jpg'], 'selfie.jpg', { type: 'image/jpeg' })

  it('기본은 후보 3명', async () => {
    await joinAsParticipant(mockSampleAccessCodes.open)

    const match = await matchSelfie({ eventId: 1, selfie })

    expect(match.candidates).toHaveLength(3)
    expect(match.candidates[0]).not.toHaveProperty('similarity')
  })

  it('후보 0명으로 설정하면 빈 배열', async () => {
    updateMockSettings({ selfieMatchScenario: 'no-candidates' })
    await joinAsParticipant(mockSampleAccessCodes.open)

    const match = await matchSelfie({ eventId: 1, selfie })

    expect(match.candidates).toEqual([])
  })

  it('얼굴 없음으로 설정하면 FACE_NOT_DETECTED(422)', async () => {
    updateMockSettings({ selfieMatchScenario: 'face-not-detected' })
    await joinAsParticipant(mockSampleAccessCodes.open)

    const error = await catchApiError(matchSelfie({ eventId: 1, selfie }))

    expect(error).toMatchObject({ code: 'FACE_NOT_DETECTED', status: 422 })
  })
})

describe('오류 재현 패널의 공통 설정', () => {
  it('토큰을 만료시키면 이미 받은 토큰으로는 UNAUTHORIZED(401)', async () => {
    await joinAsParticipant(mockSampleAccessCodes.open)
    updateMockSettings({ tokensInvalidBefore: Date.now() + 1 })

    const error = await catchApiError(getPersons({ eventId: 1, requester: 'participant' }))

    expect(error).toMatchObject({ code: 'UNAUTHORIZED', status: 401 })
  })

  it('"다음 요청 서버 오류"는 한 번만 실패한다', async () => {
    updateMockSettings({ nextRequestFailure: 'server-error' })

    const error = await catchApiError(joinEvent(mockSampleAccessCodes.open))
    const join = await joinEvent(mockSampleAccessCodes.open)

    expect(error).toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
    expect(join.status).toBe('open')
  })

  it('"다음 요청 네트워크 끊김"은 NETWORK_ERROR', async () => {
    updateMockSettings({ nextRequestFailure: 'network-error' })

    const error = await catchApiError(joinEvent(mockSampleAccessCodes.open))

    expect(error).toMatchObject({ code: 'NETWORK_ERROR', status: null })
  })

  it('이미지 주소 짧게(60초)로 설정하면 expiresIn이 60', async () => {
    updateMockSettings({ shortImageExpiry: true })
    await joinAsParticipant(mockSampleAccessCodes.open)

    const firstPage = await getEventPhotoPage({ eventId: 1, page: 1 })

    expect(firstPage.photos[0].expiresIn).toBe(60)
  })
})
