import type { FaceBox } from '@/entities/person/person-types'
import {
  createSeededRandom,
  pickRandom,
  pickWeightedIndex,
  shuffleInPlace,
  type RandomNumberGenerator,
} from '@/mocks/seeded-random'

// 행사 하나의 가짜 사진·사람·얼굴 배치를 만든다. 씨앗값이 같으면 항상 같은 결과라 저장하지 않고 그때그때 만든다.

/** 사람마다 다르게 그릴 겉모습(그림 일러스트용) */
export type PersonAppearance = {
  skinColor: string
  hairColor: string
  hairStyle: 'short' | 'long' | 'bun' | 'curly'
  shirtColor: string
  hasGlasses: boolean
}

export type MockFace = { personNumber: number; box: FaceBox }

export type MockPhoto = {
  /** 행사 안에서 1부터 매기는 번호 */
  photoNumber: number
  fileName: string
  width: number
  height: number
  /** 배경 그림을 고르는 씨앗값 */
  sceneSeed: number
  /** 얼굴 찾기에 실패한 사진(목록에서 빠지고 관리자 실패 목록에만 나옴) */
  failed: boolean
  faces: MockFace[]
}

export type MockPerson = {
  /** 행사 안에서 1부터 매기는 번호. 서버 label은 'user' + 번호 */
  personNumber: number
  photoNumbers: number[]
  /** 대표 얼굴: 이 사람이 가장 크게 나온 사진 */
  representative: { photoNumber: number; box: FaceBox }
  appearance: PersonAppearance
}

export type EventContent = { photos: MockPhoto[]; persons: MockPerson[] }

type EventContentOptions = {
  seed: number
  photoCount: number
  personCount: number
  /** 한 장에만 나오는 사람 수(배경에 지나간 사람). minPhotos=2면 숨겨진다 */
  singlePhotoPersonCount: number
  failedPhotoNumbers?: readonly number[]
  /** 업로드한 파일 이름. 없으면 IMG_0001.jpg 형식 */
  fileNames?: readonly string[]
}

// 사진 한 장에 나오는 사람 수(1~5명)의 비율. 단체 사진이 적당히 섞이게 한다
const peoplePerPhotoWeights = [0.2, 0.25, 0.25, 0.18, 0.12]

const skinColors = ['#FFE0BD', '#F9DCC4', '#F1C27D', '#E0AC69', '#C68642', '#8D5524']
const hairColors = ['#1C1C1C', '#2B1B17', '#4B2E2A', '#6F4E37', '#A0522D', '#D4A017', '#8E8E8E']
const hairStyles: PersonAppearance['hairStyle'][] = ['short', 'long', 'bun', 'curly']
const shirtColors = [
  '#4F46E5',
  '#DC2626',
  '#059669',
  '#D97706',
  '#0EA5E9',
  '#DB2777',
  '#7C3AED',
  '#374151',
  '#F59E0B',
  '#10B981',
]

export function generateEventContent({
  seed,
  photoCount,
  personCount,
  singlePhotoPersonCount,
  failedPhotoNumbers = [],
  fileNames,
}: EventContentOptions): EventContent {
  const random = createSeededRandom(seed)
  const failedPhotoNumberSet = new Set(failedPhotoNumbers)

  // 1) 사진마다 크기와 들어갈 사람 수를 정한다. 실패한 사진에는 얼굴이 없다
  const photoDrafts = Array.from({ length: photoCount }, (_, index) => {
    const photoNumber = index + 1
    const isLandscape = random() < 0.75
    const failed = failedPhotoNumberSet.has(photoNumber)
    return {
      photoNumber,
      fileName: fileNames?.[index] ?? `IMG_${String(photoNumber).padStart(4, '0')}.jpg`,
      width: isLandscape ? 1200 : 900,
      height: isLandscape ? 900 : 1200,
      sceneSeed: Math.floor(random() * 1_000_000_000),
      failed,
      slotCount: failed ? 0 : pickWeightedIndex(random, peoplePerPhotoWeights) + 1,
      personNumbers: [] as number[],
    }
  })

  // 2) 꼭 필요한 등장부터 채운다: 보통 사람은 서로 다른 사진에 2번 이상, 배경 사람은 정확히 1번
  const regularPersonCount = personCount - singlePhotoPersonCount
  const slotPhotos = shuffleInPlace(
    random,
    photoDrafts.flatMap((photo) => Array.from({ length: photo.slotCount }, () => photo)),
  )
  const usedSlotIndexes = new Set<number>()
  const requiredAppearances = [
    ...range(1, regularPersonCount),
    ...range(1, regularPersonCount),
    ...range(regularPersonCount + 1, personCount),
  ]
  for (const personNumber of requiredAppearances) {
    const slotIndex = slotPhotos.findIndex(
      (photo, index) => !usedSlotIndexes.has(index) && !photo.personNumbers.includes(personNumber),
    )
    if (slotIndex === -1) continue
    usedSlotIndexes.add(slotIndex)
    slotPhotos[slotIndex].personNumbers.push(personNumber)
  }

  // 3) 남은 자리는 보통 사람 중에서 '인기 있는' 사람(번호가 작을수록)으로 채운다. 그래야 사진 수가 고르게 갈리지 않는다
  slotPhotos.forEach((photo, slotIndex) => {
    if (usedSlotIndexes.has(slotIndex)) return
    const candidates = range(1, regularPersonCount).filter(
      (personNumber) => !photo.personNumbers.includes(personNumber),
    )
    if (candidates.length === 0) return
    const weights = candidates.map((personNumber) => 1 / personNumber ** 0.7)
    photo.personNumbers.push(candidates[pickWeightedIndex(random, weights)])
  })

  // 4) 사진 안에서 얼굴 위치를 정한다(사람 수만큼 가로로 나눈 칸에 한 명씩)
  const photos: MockPhoto[] = photoDrafts.map((draft) => ({
    photoNumber: draft.photoNumber,
    fileName: draft.fileName,
    width: draft.width,
    height: draft.height,
    sceneSeed: draft.sceneSeed,
    failed: draft.failed,
    faces: draft.personNumbers.map((personNumber, slotIndex) => ({
      personNumber,
      box: layoutFace(random, draft, slotIndex, draft.personNumbers.length),
    })),
  }))

  // 5) 사람별로 나온 사진과 대표 얼굴(가장 크게 나온 얼굴)을 모은다
  const persons: MockPerson[] = []
  for (const personNumber of range(1, personCount)) {
    const appearances = photos.flatMap((photo) =>
      photo.faces
        .filter((face) => face.personNumber === personNumber)
        .map((face) => ({ photoNumber: photo.photoNumber, box: face.box })),
    )
    if (appearances.length === 0) continue
    const representative = appearances.reduce((largest, appearance) =>
      appearance.box.w * appearance.box.h > largest.box.w * largest.box.h ? appearance : largest,
    )
    persons.push({
      personNumber,
      photoNumbers: appearances.map((appearance) => appearance.photoNumber),
      representative,
      appearance: createAppearance(createSeededRandom(seed * 7919 + personNumber)),
    })
  }

  return { photos, persons }
}

// start부터 end까지의 정수 목록(end가 start보다 작으면 빈 목록)
function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index)
}

// 칸 하나에 얼굴을 놓는다. 사람이 많을수록 얼굴을 작게, 위치는 조금씩 흔들어 자연스럽게 한다
function layoutFace(
  random: RandomNumberGenerator,
  photo: { width: number; height: number },
  slotIndex: number,
  slotCount: number,
): FaceBox {
  const slotWidth = photo.width / slotCount
  const faceHeightRatio =
    slotCount === 1 ? 0.3 : slotCount === 2 ? 0.24 : slotCount === 3 ? 0.2 : 0.16
  const faceHeight = Math.round(
    Math.min(photo.width, photo.height) * faceHeightRatio * (0.88 + random() * 0.24),
  )
  const faceWidth = Math.round(faceHeight * 0.8)
  const centerX = slotWidth * (slotIndex + 0.5) + (random() - 0.5) * slotWidth * 0.2
  const left = Math.min(Math.max(Math.round(centerX - faceWidth / 2), 0), photo.width - faceWidth)
  const top = Math.round(photo.height * (0.22 + random() * 0.14))
  return { x: left, y: top, w: faceWidth, h: faceHeight }
}

// 사람마다 피부·머리·옷 색과 머리 모양, 안경을 정한다
function createAppearance(random: RandomNumberGenerator): PersonAppearance {
  return {
    skinColor: pickRandom(random, skinColors),
    hairColor: pickRandom(random, hairColors),
    hairStyle: pickRandom(random, hairStyles),
    shirtColor: pickRandom(random, shirtColors),
    hasGlasses: random() < 0.2,
  }
}
