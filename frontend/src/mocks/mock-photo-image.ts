import type { MockPerson, MockPhoto, PersonAppearance } from '@/mocks/event-content'
import { createSeededRandom, pickRandom, randomInteger } from '@/mocks/seeded-random'

// 가짜 행사 사진을 캔버스로 그려 JPG로 만든다. 실제 인물 대신 사람마다 겉모습이 다른 일러스트를 그리고,
// 얼굴 위치를 서버가 줄 bbox와 똑같이 맞춰 FaceCrop·폴더 합치기를 눈으로 확인할 수 있게 한다.

type DrawingContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

// 같은 사진을 다시 그리지 않도록 만든 결과를 기억한다(목록을 다시 받아 주소가 바뀌어도 그림은 같음)
const imageCache = new Map<number, Promise<Blob>>()

// 배경 분위기: 낮 야외, 노을, 실내 강당, 밤 축제
const scenePalettes = [
  { skyTop: '#9CC9F5', skyBottom: '#DCEEFF', ground: '#9BC58A', decoration: '#FFFFFF' },
  { skyTop: '#F7A27B', skyBottom: '#FCE3C4', ground: '#C9A27E', decoration: '#FFF4D6' },
  { skyTop: '#E9DCC9', skyBottom: '#F6EFE4', ground: '#B9A48D', decoration: '#C7D2FE' },
  { skyTop: '#1E1B4B', skyBottom: '#3730A3', ground: '#2E2A5A', decoration: '#FDE68A' },
]
const buntingColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6']

export function renderMockPhotoImage(
  photoId: number,
  photo: MockPhoto,
  persons: readonly MockPerson[],
): Promise<Blob> {
  const cachedImage = imageCache.get(photoId)
  if (cachedImage) return cachedImage
  const renderedImage = drawPhoto(photo, persons)
  imageCache.set(photoId, renderedImage)
  return renderedImage
}

async function drawPhoto(photo: MockPhoto, persons: readonly MockPerson[]): Promise<Blob> {
  const canvas = createCanvas(photo.width, photo.height)
  const context = canvas.getContext('2d') as DrawingContext
  const random = createSeededRandom(photo.sceneSeed)

  drawBackground(context, photo, random)

  // 작은 얼굴(뒤에 선 사람)부터 그려서 큰 얼굴(앞사람)이 위에 오게 한다
  const facesFromBack = [...photo.faces].sort((first, second) => first.box.h - second.box.h)
  for (const face of facesFromBack) {
    const person = persons.find((candidate) => candidate.personNumber === face.personNumber)
    if (person) drawPerson(context, face.box, person.appearance, photo.height)
  }

  drawFileNameLabel(context, photo)
  return canvasToJpeg(canvas)
}

// 브라우저가 지원하면 화면 밖 캔버스를, 아니면 일반 캔버스를 쓴다
function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function canvasToJpeg(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('가짜 사진을 만들지 못했어요'))),
      'image/jpeg',
      0.85,
    )
  })
}

// 하늘·땅과 장식(만국기 또는 빛망울)을 그린다
function drawBackground(context: DrawingContext, photo: MockPhoto, random: () => number): void {
  const palette = pickRandom(random, scenePalettes)
  const horizonY = photo.height * (0.55 + random() * 0.1)

  const skyGradient = context.createLinearGradient(0, 0, 0, horizonY)
  skyGradient.addColorStop(0, palette.skyTop)
  skyGradient.addColorStop(1, palette.skyBottom)
  context.fillStyle = skyGradient
  context.fillRect(0, 0, photo.width, horizonY)
  context.fillStyle = palette.ground
  context.fillRect(0, horizonY, photo.width, photo.height - horizonY)

  if (random() < 0.5) {
    // 만국기: 위쪽에 늘어진 줄을 따라 삼각형 깃발
    const flagCount = randomInteger(random, 10, 16)
    const ropeY = photo.height * 0.08
    for (let flagIndex = 0; flagIndex < flagCount; flagIndex += 1) {
      const flagLeft = (photo.width / flagCount) * flagIndex
      const sagY = ropeY + Math.sin((flagIndex / flagCount) * Math.PI) * photo.height * 0.05
      context.fillStyle = buntingColors[flagIndex % buntingColors.length]
      context.beginPath()
      context.moveTo(flagLeft, sagY)
      context.lineTo(flagLeft + photo.width / flagCount, sagY)
      context.lineTo(flagLeft + photo.width / flagCount / 2, sagY + photo.height * 0.06)
      context.closePath()
      context.fill()
    }
  } else {
    // 빛망울: 반투명한 동그라미 여러 개
    context.fillStyle = palette.decoration
    for (let bokehIndex = 0; bokehIndex < 14; bokehIndex += 1) {
      context.globalAlpha = 0.15 + random() * 0.25
      context.beginPath()
      context.arc(
        random() * photo.width,
        random() * horizonY,
        photo.height * (0.015 + random() * 0.04),
        0,
        Math.PI * 2,
      )
      context.fill()
    }
    context.globalAlpha = 1
  }
}

// 한 사람을 그린다. 머리(타원)가 정확히 bbox를 채우도록 그려서 서버 bbox와 그림이 맞는다
function drawPerson(
  context: DrawingContext,
  box: { x: number; y: number; w: number; h: number },
  appearance: PersonAppearance,
  photoHeight: number,
): void {
  const centerX = box.x + box.w / 2
  const centerY = box.y + box.h / 2
  const radiusX = box.w / 2
  const radiusY = box.h / 2

  // 몸통(옷)과 목
  context.fillStyle = appearance.shirtColor
  drawRoundedRectangle(
    context,
    centerX - box.w * 0.95,
    box.y + box.h * 0.92,
    box.w * 1.9,
    photoHeight - (box.y + box.h * 0.92) + box.w,
    box.w * 0.45,
  )
  context.fillStyle = appearance.skinColor
  context.fillRect(centerX - box.w * 0.17, centerY + radiusY * 0.6, box.w * 0.34, box.h * 0.32)

  // 긴 머리는 얼굴 뒤에 먼저 그린다
  context.fillStyle = appearance.hairColor
  if (appearance.hairStyle === 'long') {
    drawEllipse(context, centerX, centerY + radiusY * 0.25, radiusX * 1.18, radiusY * 1.15)
  }

  // 얼굴
  context.fillStyle = appearance.skinColor
  drawEllipse(context, centerX, centerY, radiusX, radiusY)

  // 머리 윗부분
  context.fillStyle = appearance.hairColor
  if (appearance.hairStyle === 'curly') {
    for (let curlIndex = 0; curlIndex < 7; curlIndex += 1) {
      const angle = Math.PI + (Math.PI * curlIndex) / 6
      drawEllipse(
        context,
        centerX + Math.cos(angle) * radiusX * 0.85,
        centerY + Math.sin(angle) * radiusY * 0.8,
        radiusX * 0.32,
        radiusX * 0.32,
      )
    }
  } else {
    context.beginPath()
    context.ellipse(
      centerX,
      centerY - radiusY * 0.12,
      radiusX * 1.04,
      radiusY * 0.92,
      0,
      Math.PI,
      Math.PI * 2,
    )
    context.fill()
    if (appearance.hairStyle === 'bun') {
      drawEllipse(context, centerX, box.y - radiusY * 0.12, radiusX * 0.42, radiusX * 0.42)
    }
  }

  // 눈·볼·웃는 입
  context.fillStyle = '#1E1B4B'
  drawEllipse(
    context,
    centerX - radiusX * 0.36,
    centerY + radiusY * 0.05,
    radiusX * 0.1,
    radiusX * 0.12,
  )
  drawEllipse(
    context,
    centerX + radiusX * 0.36,
    centerY + radiusY * 0.05,
    radiusX * 0.1,
    radiusX * 0.12,
  )
  context.fillStyle = 'rgba(244, 114, 182, 0.35)'
  drawEllipse(
    context,
    centerX - radiusX * 0.55,
    centerY + radiusY * 0.3,
    radiusX * 0.16,
    radiusX * 0.1,
  )
  drawEllipse(
    context,
    centerX + radiusX * 0.55,
    centerY + radiusY * 0.3,
    radiusX * 0.16,
    radiusX * 0.1,
  )
  context.strokeStyle = '#1E1B4B'
  context.lineWidth = Math.max(2, box.w * 0.04)
  context.lineCap = 'round'
  context.beginPath()
  context.arc(centerX, centerY + radiusY * 0.28, radiusX * 0.32, Math.PI * 0.15, Math.PI * 0.85)
  context.stroke()

  if (appearance.hasGlasses) {
    context.lineWidth = Math.max(2, box.w * 0.03)
    for (const side of [-1, 1]) {
      context.beginPath()
      context.arc(
        centerX + side * radiusX * 0.36,
        centerY + radiusY * 0.05,
        radiusX * 0.24,
        0,
        Math.PI * 2,
      )
      context.stroke()
    }
    context.beginPath()
    context.moveTo(centerX - radiusX * 0.12, centerY + radiusY * 0.05)
    context.lineTo(centerX + radiusX * 0.12, centerY + radiusY * 0.05)
    context.stroke()
  }
}

// 사진 오른쪽 아래에 파일 이름을 적는다(크게 보기·저장 순서를 눈으로 확인하려고)
function drawFileNameLabel(context: DrawingContext, photo: MockPhoto): void {
  const fontSize = Math.round(photo.height * 0.03)
  context.font = `600 ${fontSize}px sans-serif`
  const labelWidth = context.measureText(photo.fileName).width + fontSize
  context.fillStyle = 'rgba(17, 24, 39, 0.55)'
  context.fillRect(
    photo.width - labelWidth - fontSize,
    photo.height - fontSize * 2.4,
    labelWidth,
    fontSize * 1.6,
  )
  context.fillStyle = '#FFFFFF'
  context.fillText(
    photo.fileName,
    photo.width - labelWidth - fontSize / 2,
    photo.height - fontSize * 1.15,
  )
}

function drawEllipse(
  context: DrawingContext,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
): void {
  context.beginPath()
  context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2)
  context.fill()
}

function drawRoundedRectangle(
  context: DrawingContext,
  left: number,
  top: number,
  width: number,
  height: number,
  cornerRadius: number,
): void {
  context.beginPath()
  context.roundRect(left, top, width, height, cornerRadius)
  context.fill()
}
