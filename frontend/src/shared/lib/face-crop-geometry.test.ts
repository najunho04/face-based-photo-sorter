import { describe, expect, it } from 'vitest'
import { calculateFaceCropDrawing, isDrawableFace } from '@/shared/lib/face-crop-geometry'

describe('calculateFaceCropDrawing (원본에서 얼굴 둘레를 잘라 작은 캔버스에 그릴 위치)', () => {
  it('얼굴 중심으로 얼굴보다 여유(1.4배) 있는 정사각형을 잘라 캔버스 전체에 그린다', () => {
    // 얼굴 100×100, 중심 (550, 450) → 자를 한 변 140, 왼쪽 위 (480, 380)
    const drawing = calculateFaceCropDrawing({
      faceBox: { x: 500, y: 400, w: 100, h: 100 },
      marginRatio: 1.4,
      imageWidth: 1200,
      imageHeight: 900,
      outputSize: 280,
    })
    expect(drawing).toEqual({
      sourceX: 480,
      sourceY: 380,
      sourceWidth: 140,
      sourceHeight: 140,
      destinationX: 0,
      destinationY: 0,
      destinationWidth: 280,
      destinationHeight: 280,
    })
  })

  it('세로로 긴 얼굴은 긴 쪽(높이)을 기준으로 정사각형을 잡는다', () => {
    const drawing = calculateFaceCropDrawing({
      faceBox: { x: 100, y: 100, w: 50, h: 100 },
      marginRatio: 1,
      imageWidth: 1200,
      imageHeight: 900,
      outputSize: 100,
    })
    expect(drawing.sourceWidth).toBe(100)
    expect(drawing.sourceHeight).toBe(100)
    expect(drawing.sourceX).toBe(75)
    expect(drawing.sourceY).toBe(100)
  })

  it('사진 왼쪽 위 가장자리에 걸친 얼굴은 사진 안쪽만 잘라, 캔버스에서 같은 비율 위치에 그린다', () => {
    // 자를 영역 (-20, -20) ~ (120, 120) 중 사진 안쪽은 (0, 0) ~ (120, 120)
    const drawing = calculateFaceCropDrawing({
      faceBox: { x: 0, y: 0, w: 100, h: 100 },
      marginRatio: 1.4,
      imageWidth: 1200,
      imageHeight: 900,
      outputSize: 140,
    })
    expect(drawing).toEqual({
      sourceX: 0,
      sourceY: 0,
      sourceWidth: 120,
      sourceHeight: 120,
      destinationX: 20,
      destinationY: 20,
      destinationWidth: 120,
      destinationHeight: 120,
    })
  })

  it('사진 오른쪽 아래 가장자리에 걸친 얼굴도 사진 밖 부분은 빼고 그린다', () => {
    // 자를 영역 (1080, 780) ~ (1220, 920), 사진은 1200×900
    const drawing = calculateFaceCropDrawing({
      faceBox: { x: 1100, y: 800, w: 100, h: 100 },
      marginRatio: 1.4,
      imageWidth: 1200,
      imageHeight: 900,
      outputSize: 140,
    })
    expect(drawing).toEqual({
      sourceX: 1080,
      sourceY: 780,
      sourceWidth: 120,
      sourceHeight: 120,
      destinationX: 0,
      destinationY: 0,
      destinationWidth: 120,
      destinationHeight: 120,
    })
  })
})

describe('isDrawableFace (대표 얼굴을 그릴 수 있는지)', () => {
  const faceBox = { x: 10, y: 20, w: 30, h: 40 }

  it('주소와 얼굴 위치가 모두 있으면 그릴 수 있다', () => {
    expect(isDrawableFace('https://storage.example/1.jpg', faceBox)).toBe(true)
  })

  it('주소가 비어 있으면(null·빈 글자) 그릴 수 없다(백엔드가 주소를 아직 만들지 못한 경우)', () => {
    expect(isDrawableFace(null, faceBox)).toBe(false)
    expect(isDrawableFace(undefined, faceBox)).toBe(false)
    expect(isDrawableFace('', faceBox)).toBe(false)
  })

  it('얼굴 위치가 없거나 크기가 0이면 그릴 수 없다', () => {
    expect(isDrawableFace('https://storage.example/1.jpg', null)).toBe(false)
    expect(isDrawableFace('https://storage.example/1.jpg', undefined)).toBe(false)
    expect(isDrawableFace('https://storage.example/1.jpg', { ...faceBox, w: 0 })).toBe(false)
    expect(isDrawableFace('https://storage.example/1.jpg', { ...faceBox, h: Number.NaN })).toBe(
      false,
    )
  })
})
