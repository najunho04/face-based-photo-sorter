import { http } from 'msw'
import type { Person } from '@/entities/person/person-types'
import type { MockPerson } from '@/mocks/event-content'
import {
  findMockEventIdByAccessCode,
  getMockEvent,
  splitMockId,
  toPersonId,
  toPhotoId,
  type MockEventSnapshot,
} from '@/mocks/mock-database'
import { createMockPhotoUrls } from '@/mocks/mock-photo-url'
import {
  applyServerConditions,
  authorizeRequest,
  failureResponse,
  readFormFiles,
  readJsonBody,
  successResponse,
  supportedImageTypes,
} from '@/mocks/mock-response'
import { getMockSettings } from '@/mocks/mock-settings'
import { createMockToken } from '@/mocks/mock-tokens'

// 참가자 API 가짜 핸들러 (docs/api.md #6~#10). #9·#10은 관리자 토큰으로도 부를 수 있다.

/** 셀카 한 장의 최대 크기(가짜). 프론트가 1024px로 줄여 보낸다 */
const maximumSelfieBytes = 10 * 1024 * 1024

// 사람 하나를 API 응답 모양(#8·#10)으로 바꾼다. 대표 얼굴은 원본 사진 주소 + 얼굴 위치
function toApiPerson(event: MockEventSnapshot, person: MockPerson): Person {
  const representativePhoto = event.content!.photos[person.representative.photoNumber - 1]
  const { representativeFaceMode } = getMockSettings()
  return {
    personId: toPersonId(event.eventId, person.personNumber),
    label: `user${person.personNumber}`,
    photoCount: person.photoNumbers.length,
    // 패널의 '대표 얼굴 비우기' 설정이면 실제 백엔드처럼 주소나 대표 얼굴을 비워 보낸다
    repFace:
      representativeFaceMode === 'missing-face'
        ? null
        : {
            url:
              representativeFaceMode === 'missing-url'
                ? null
                : createMockPhotoUrls(
                    toPhotoId(event.eventId, representativePhoto.photoNumber),
                    representativePhoto.fileName,
                  ).url,
            bbox: person.representative.box,
          },
  }
}

// 사진 수 많은 순(같으면 번호 순)으로 정렬한다 (docs/api.md #10: photoCount 내림차순)
function sortByPhotoCount(persons: MockPerson[]): MockPerson[] {
  return [...persons].sort(
    (first, second) =>
      second.photoNumbers.length - first.photoNumbers.length ||
      first.personNumber - second.personNumber,
  )
}

// 정수 쿼리 값을 읽는다. 없으면 기본값, 숫자가 아니거나 범위를 벗어나면 null
function readIntegerQuery(
  searchParams: URLSearchParams,
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number | null {
  const rawValue = searchParams.get(name)
  if (rawValue === null) return defaultValue
  const value = Number(rawValue)
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : null
}

// 공개된 행사만 사진·사람을 보여 준다. 공통 확인(행사 없음 → 404, 정리 중 → 409)을 한곳에 모았다
function getOpenEvent(
  eventId: number,
): { event: MockEventSnapshot; failure: null } | { event: null; failure: Response } {
  const event = getMockEvent(eventId)
  if (!event) return { event: null, failure: failureResponse('EVENT_NOT_FOUND') }
  if (event.status !== 'open' || !event.content) {
    return { event: null, failure: failureResponse('EVENT_NOT_READY') }
  }
  return { event, failure: null }
}

export const participantHandlers = [
  // #6 참가자 입장: 정리 중인 행사도 입장은 되고 status로 알려 준다
  http.post('*/api/events/join', async ({ request }) => {
    const simulatedFailure = await applyServerConditions()
    if (simulatedFailure) return simulatedFailure

    const body = await readJsonBody(request)
    const accessCode = body?.accessCode
    if (typeof accessCode !== 'string' || accessCode.length === 0) {
      return failureResponse('INVALID_REQUEST')
    }
    const eventId = findMockEventIdByAccessCode(accessCode)
    const event = eventId === null ? null : getMockEvent(eventId)
    if (!event) return failureResponse('INVALID_ACCESS_CODE')

    return successResponse({
      accessToken: createMockToken('participant', event.eventId),
      eventId: event.eventId,
      eventName: event.name,
      status: event.status,
    })
  }),

  // #7 전체 사진: 페이지 단위. 공개 전에는 사진 주소가 없으므로 EVENT_NOT_READY로 답한다(명세에 없는 부분, 백엔드 확인 필요)
  http.get('*/api/events/:eventId/photos', async ({ request, params }) => {
    const simulatedFailure = await applyServerConditions()
    if (simulatedFailure) return simulatedFailure
    const eventId = Number(params.eventId)
    const authorization = authorizeRequest(request, ['participant'], eventId)
    if (authorization.failure) return authorization.failure
    const openEvent = getOpenEvent(eventId)
    if (openEvent.failure) return openEvent.failure

    const searchParams = new URL(request.url).searchParams
    const page = readIntegerQuery(searchParams, 'page', 1, 1, 10_000)
    const size = readIntegerQuery(searchParams, 'size', 30, 1, 100)
    if (page === null || size === null) return failureResponse('INVALID_REQUEST')

    const visiblePhotos = openEvent.event.content!.photos.filter((photo) => !photo.failed)
    const pagePhotos = visiblePhotos.slice((page - 1) * size, page * size)
    return successResponse({
      page,
      size,
      total: visiblePhotos.length,
      photos: pagePhotos.map((photo) => {
        const photoId = toPhotoId(eventId, photo.photoNumber)
        const { url, expiresIn } = createMockPhotoUrls(photoId, photo.fileName)
        return { photoId, fileName: photo.fileName, url, expiresIn }
      }),
    })
  }),

  // #8 셀카 검색: 결과는 오류 재현 패널의 설정을 따른다(가짜 서버는 얼굴을 분석하지 못함)
  http.post('*/api/events/:eventId/match', async ({ request, params }) => {
    const simulatedFailure = await applyServerConditions()
    if (simulatedFailure) return simulatedFailure
    const eventId = Number(params.eventId)
    const authorization = authorizeRequest(request, ['participant'], eventId)
    if (authorization.failure) return authorization.failure
    const openEvent = getOpenEvent(eventId)
    if (openEvent.failure) return openEvent.failure

    const [selfie] = await readFormFiles(request, 'selfie')
    if (!selfie) return failureResponse('INVALID_REQUEST')
    if (!supportedImageTypes.includes(selfie.type)) return failureResponse('UNSUPPORTED_FILE')
    if (selfie.size > maximumSelfieBytes) return failureResponse('FILE_TOO_LARGE')

    const scenario = getMockSettings().selfieMatchScenario
    if (scenario === 'face-not-detected') return failureResponse('FACE_NOT_DETECTED')
    // 사진 수 순서에서 2·5·10번째 사람을 후보로 고른다(항상 같은 후보라 화면 확인이 쉽다)
    const sortedPersons = sortByPhotoCount(openEvent.event.content!.persons)
    const candidatePositions = {
      'three-candidates': [1, 4, 9],
      'one-candidate': [1],
      'no-candidates': [],
    }[scenario]
    const candidates = candidatePositions
      .map((position) => sortedPersons[position])
      .filter((person): person is MockPerson => person !== undefined)
      .map((person) => toApiPerson(openEvent.event, person))
    return successResponse({ candidates })
  }),

  // #9 사람 폴더 사진: 이 사람이 나온 사진 전체(페이지 없음)
  http.get('*/api/events/:eventId/persons/:personId/photos', async ({ request, params }) => {
    const simulatedFailure = await applyServerConditions()
    if (simulatedFailure) return simulatedFailure
    const eventId = Number(params.eventId)
    const authorization = authorizeRequest(request, ['admin', 'participant'], eventId)
    if (authorization.failure) return authorization.failure
    const openEvent = getOpenEvent(eventId)
    if (openEvent.failure) return openEvent.failure

    const { eventId: personEventId, numberInEvent } = splitMockId(Number(params.personId))
    const person =
      personEventId === eventId
        ? openEvent.event.content!.persons.find(
            (candidate) => candidate.personNumber === numberInEvent,
          )
        : undefined
    if (!person) return failureResponse('PERSON_NOT_FOUND')

    return successResponse({
      personId: toPersonId(eventId, person.personNumber),
      label: `user${person.personNumber}`,
      total: person.photoNumbers.length,
      photos: person.photoNumbers.map((photoNumber) => {
        const photo = openEvent.event.content!.photos[photoNumber - 1]
        const photoId = toPhotoId(eventId, photoNumber)
        return {
          photoId,
          fileName: photo.fileName,
          ...createMockPhotoUrls(photoId, photo.fileName),
        }
      }),
    })
  }),

  // #10 사람 폴더 목록: minPhotos 이상 나온 사람만, 사진 수 많은 순
  http.get('*/api/events/:eventId/persons', async ({ request, params }) => {
    const simulatedFailure = await applyServerConditions()
    if (simulatedFailure) return simulatedFailure
    const eventId = Number(params.eventId)
    const authorization = authorizeRequest(request, ['admin', 'participant'], eventId)
    if (authorization.failure) return authorization.failure
    const openEvent = getOpenEvent(eventId)
    if (openEvent.failure) return openEvent.failure

    const minimumPhotos = readIntegerQuery(
      new URL(request.url).searchParams,
      'minPhotos',
      1,
      1,
      10_000,
    )
    if (minimumPhotos === null) return failureResponse('INVALID_REQUEST')

    const persons = sortByPhotoCount(openEvent.event.content!.persons).filter(
      (person) => person.photoNumbers.length >= minimumPhotos,
    )
    return successResponse({
      total: persons.length,
      persons: persons.map((person) => toApiPerson(openEvent.event, person)),
    })
  }),
]
