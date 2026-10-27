import type { EventStatus } from '@/entities/event/event-status'
import { mockSampleAccessCodes } from '@/mocks/mock-accounts'
import { generateEventContent, type EventContent } from '@/mocks/event-content'
import { readStoredValue, removeStoredValue, writeStoredValue } from '@/shared/lib/stored-value'

// 가짜 서버의 데이터. 행사 내용(사진·사람)은 씨앗값으로 그때그때 만들고,
// 관리자가 바꾸는 것(만든 행사, 올린 파일 이름, 업로드 완료 시각)만 localStorage에 저장해 새로고침해도 남긴다.

const databaseKey = 'insaengnaecut.mock-database'

/** 얼굴 찾기 1장에 걸리는 시간(가짜). 100장이면 30초 */
const extractionMillisecondsPerPhoto = 300
/** 사람별로 묶는 데 걸리는 시간(가짜) */
const clusteringMilliseconds = 5_000
/** 동시에 처리 중인 장 수(가짜 워커 4대) */
const processingPhotoCount = 4
/** 이 번호의 사진은 얼굴 찾기에 실패한 것으로 만든다(시안 A5의 IMG_0013 실패 예시) */
const failingPhotoNumber = 13

/** 관리자가 만든 행사. 업로드·완료에 따라 상태가 바뀐다 */
type StoredEvent = {
  eventId: number
  name: string
  accessCode: string
  uploadedFileNames: string[]
  uploadCompletedAt: number | null
}

type StoredDatabase = { nextEventId: number; events: StoredEvent[] }

/** 화면 개발용으로 상태를 고정해 둔 샘플 행사 */
type FixedSampleEvent = {
  eventId: number
  name: string
  accessCode: string
  status: Exclude<EventStatus, 'uploading'>
  photoCount: number
  personCount: number
  singlePhotoPersonCount: number
  extractedCount: number
  processingCount: number
  failedPhotoNumbers: number[]
}

// 시안 A2의 행사들. '업로드 중' 샘플(동아리 MT)은 실제로 업로드·완료를 해 볼 수 있게 저장 행사로 만든다
const fixedSampleEvents: FixedSampleEvent[] = [
  {
    eventId: 1,
    name: '2026 가을 축제',
    accessCode: mockSampleAccessCodes.open,
    status: 'open',
    photoCount: 100,
    personCount: 48,
    singlePhotoPersonCount: 8,
    extractedCount: 100,
    processingCount: 0,
    failedPhotoNumbers: [],
  },
  {
    eventId: 2,
    name: '졸업 사진 촬영',
    accessCode: mockSampleAccessCodes.clustering,
    status: 'clustering',
    photoCount: 60,
    personCount: 28,
    singlePhotoPersonCount: 4,
    extractedCount: 60,
    processingCount: 0,
    failedPhotoNumbers: [],
  },
  {
    eventId: 3,
    name: '신입생 MT',
    accessCode: mockSampleAccessCodes.extracting,
    status: 'extracting',
    photoCount: 100,
    personCount: 45,
    singlePhotoPersonCount: 6,
    extractedCount: 63,
    processingCount: 4,
    failedPhotoNumbers: [failingPhotoNumber],
  },
]

// 처음 상태: '업로드 중' 샘플 행사 하나(사진 64장 올림, 완료 전)
function createInitialDatabase(): StoredDatabase {
  return {
    nextEventId: 5,
    events: [
      {
        eventId: 4,
        name: '동아리 MT',
        accessCode: mockSampleAccessCodes.uploading,
        uploadedFileNames: Array.from(
          { length: 64 },
          (_, index) => `IMG_${String(index + 1).padStart(4, '0')}.jpg`,
        ),
        uploadCompletedAt: null,
      },
    ],
  }
}

function isStoredDatabase(value: unknown): value is StoredDatabase {
  const candidate = value as Partial<StoredDatabase> | null
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.nextEventId === 'number' &&
    Array.isArray(candidate.events)
  )
}

let database: StoredDatabase =
  readStoredValue('local', databaseKey, isStoredDatabase) ?? createInitialDatabase()

function saveDatabase(): void {
  writeStoredValue('local', databaseKey, database)
}

/** 가짜 데이터를 처음 상태로 되돌린다(오류 재현 패널의 초기화, 테스트 정리) */
export function resetMockDatabase(): void {
  removeStoredValue('local', databaseKey)
  database = createInitialDatabase()
  contentCache.clear()
}

// ── 번호 변환: 사진·사람 번호를 행사 번호와 합쳐 서버 전체에서 겹치지 않는 id로 만든다 ──

const idMultiplier = 10_000

export function toPhotoId(eventId: number, photoNumber: number): number {
  return eventId * idMultiplier + photoNumber
}

export function toPersonId(eventId: number, personNumber: number): number {
  return eventId * idMultiplier + personNumber
}

/** photoId·personId를 행사 번호와 행사 안 번호로 나눈다 */
export function splitMockId(id: number): { eventId: number; numberInEvent: number } {
  return { eventId: Math.floor(id / idMultiplier), numberInEvent: id % idMultiplier }
}

// ── 행사 조회 ──

/** 지금 시각 기준 행사 상태. 가짜 서버의 핸들러들이 이 값으로 응답을 만든다 */
export type MockEventSnapshot = {
  eventId: number
  name: string
  accessCode: string
  status: EventStatus
  photoCounts: { total: number; extracted: number; processing: number; failed: number }
  failedPhotos: Array<{ photoNumber: number; fileName: string }>
  /** 공개된 행사만 사진·사람 내용이 있다 */
  content: EventContent | null
}

const contentCache = new Map<string, EventContent>()

// 같은 행사 내용을 매번 다시 만들지 않도록 기억해 둔다
function getCachedContent(cacheKey: string, createContent: () => EventContent): EventContent {
  const cachedContent = contentCache.get(cacheKey)
  if (cachedContent) return cachedContent
  const createdContent = createContent()
  contentCache.set(cacheKey, createdContent)
  return createdContent
}

export function getMockEvent(eventId: number, now = Date.now()): MockEventSnapshot | null {
  const sampleEvent = fixedSampleEvents.find((event) => event.eventId === eventId)
  if (sampleEvent) return snapshotSampleEvent(sampleEvent)
  const storedEvent = database.events.find((event) => event.eventId === eventId)
  return storedEvent ? snapshotStoredEvent(storedEvent, now) : null
}

export function findMockEventIdByAccessCode(accessCode: string): number | null {
  const allEvents = [...fixedSampleEvents, ...database.events]
  return allEvents.find((event) => event.accessCode === accessCode)?.eventId ?? null
}

// 고정 샘플 행사의 상태를 그대로 돌려준다
function snapshotSampleEvent(sampleEvent: FixedSampleEvent): MockEventSnapshot {
  return {
    eventId: sampleEvent.eventId,
    name: sampleEvent.name,
    accessCode: sampleEvent.accessCode,
    status: sampleEvent.status,
    photoCounts: {
      total: sampleEvent.photoCount,
      extracted: sampleEvent.extractedCount,
      processing: sampleEvent.processingCount,
      failed: sampleEvent.failedPhotoNumbers.length,
    },
    failedPhotos: sampleEvent.failedPhotoNumbers.map((photoNumber) => ({
      photoNumber,
      fileName: `IMG_${String(photoNumber).padStart(4, '0')}.jpg`,
    })),
    content:
      sampleEvent.status === 'open'
        ? getCachedContent(`sample-${sampleEvent.eventId}`, () =>
            generateEventContent({
              seed: sampleEvent.eventId,
              photoCount: sampleEvent.photoCount,
              personCount: sampleEvent.personCount,
              singlePhotoPersonCount: sampleEvent.singlePhotoPersonCount,
              failedPhotoNumbers: sampleEvent.failedPhotoNumbers,
            }),
          )
        : null,
  }
}

// 만든 행사의 상태를 업로드 완료 후 흐른 시간으로 계산한다: 얼굴 찾기 → 사람별로 묶기 → 공개
function snapshotStoredEvent(storedEvent: StoredEvent, now: number): MockEventSnapshot {
  const total = storedEvent.uploadedFileNames.length
  const failedPhotoNumbers = total >= failingPhotoNumber ? [failingPhotoNumber] : []
  const failedPhotos = failedPhotoNumbers.map((photoNumber) => ({
    photoNumber,
    fileName: storedEvent.uploadedFileNames[photoNumber - 1],
  }))
  const baseSnapshot = {
    eventId: storedEvent.eventId,
    name: storedEvent.name,
    accessCode: storedEvent.accessCode,
  }

  if (storedEvent.uploadCompletedAt === null) {
    return {
      ...baseSnapshot,
      status: 'uploading',
      photoCounts: { total, extracted: 0, processing: 0, failed: 0 },
      failedPhotos: [],
      content: null,
    }
  }

  const elapsedMilliseconds = now - storedEvent.uploadCompletedAt
  const extractionMilliseconds = Math.max(5_000, total * extractionMillisecondsPerPhoto)
  if (elapsedMilliseconds < extractionMilliseconds) {
    const finishedCount = Math.floor((total * elapsedMilliseconds) / extractionMilliseconds)
    const failedSoFar = failedPhotos.filter((photo) => photo.photoNumber <= finishedCount)
    return {
      ...baseSnapshot,
      status: 'extracting',
      photoCounts: {
        total,
        extracted: finishedCount - failedSoFar.length,
        processing: Math.min(processingPhotoCount, total - finishedCount),
        failed: failedSoFar.length,
      },
      failedPhotos: failedSoFar,
      content: null,
    }
  }

  const finishedPhotoCounts = {
    total,
    extracted: total - failedPhotos.length,
    processing: 0,
    failed: failedPhotos.length,
  }
  if (elapsedMilliseconds < extractionMilliseconds + clusteringMilliseconds) {
    return {
      ...baseSnapshot,
      status: 'clustering',
      photoCounts: finishedPhotoCounts,
      failedPhotos,
      content: null,
    }
  }

  // 공개: 업로드한 사진 수에 맞춰 사람 수를 정한다(실제 얼굴 분석은 못 하므로 샘플 사람으로 채움)
  const personCount = Math.min(60, Math.max(1, Math.round((total - failedPhotos.length) * 0.45)))
  return {
    ...baseSnapshot,
    status: 'open',
    photoCounts: finishedPhotoCounts,
    failedPhotos,
    content: getCachedContent(`stored-${storedEvent.eventId}-${total}`, () =>
      generateEventContent({
        seed: storedEvent.eventId,
        photoCount: total,
        personCount,
        singlePhotoPersonCount: Math.floor(personCount * 0.15),
        failedPhotoNumbers,
        fileNames: storedEvent.uploadedFileNames,
      }),
    ),
  }
}

// ── 관리자 작업 ──

// 헷갈리는 글자(0·O, 1·I)를 뺀 인증코드 글자
const accessCodeCharacters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// 다른 행사와 겹치지 않는 6자리 인증코드를 만든다
function createUniqueAccessCode(): string {
  for (;;) {
    const accessCode = Array.from(
      { length: 6 },
      () => accessCodeCharacters[Math.floor(Math.random() * accessCodeCharacters.length)],
    ).join('')
    if (findMockEventIdByAccessCode(accessCode) === null) return accessCode
  }
}

export function createMockEvent(name: string): MockEventSnapshot {
  const storedEvent: StoredEvent = {
    eventId: database.nextEventId,
    name,
    accessCode: createUniqueAccessCode(),
    uploadedFileNames: [],
    uploadCompletedAt: null,
  }
  database = { nextEventId: database.nextEventId + 1, events: [...database.events, storedEvent] }
  saveDatabase()
  return snapshotStoredEvent(storedEvent, Date.now())
}

// 업로드에 성공한 파일 이름을 행사에 더한다. 업로드 중인 저장 행사에만 부른다
export function addMockUploadedFiles(eventId: number, fileNames: string[]): void {
  updateStoredEvent(eventId, (storedEvent) => ({
    ...storedEvent,
    uploadedFileNames: [...storedEvent.uploadedFileNames, ...fileNames],
  }))
}

// 업로드 완료 시각을 기록한다. 이때부터 시간이 흐르며 상태가 바뀐다
export function completeMockUpload(eventId: number, now = Date.now()): void {
  updateStoredEvent(eventId, (storedEvent) => ({ ...storedEvent, uploadCompletedAt: now }))
}

function updateStoredEvent(eventId: number, update: (storedEvent: StoredEvent) => StoredEvent) {
  database = {
    ...database,
    events: database.events.map((storedEvent) =>
      storedEvent.eventId === eventId ? update(storedEvent) : storedEvent,
    ),
  }
  saveDatabase()
}

/** 오류 재현 패널에 보여 줄 행사 목록(번호·이름·코드·상태) */
export function listMockEvents(now = Date.now()): MockEventSnapshot[] {
  return [
    ...fixedSampleEvents.map((event) => event.eventId),
    ...database.events.map((event) => event.eventId),
  ]
    .map((eventId) => getMockEvent(eventId, now))
    .filter((snapshot): snapshot is MockEventSnapshot => snapshot !== null)
}
