/** 원본 사진 안에서 얼굴 위치 (API의 bbox, 서버에 저장된 이미지 기준 픽셀) */
export type FaceBoundingBox = { x: number; y: number; w: number; h: number }

/** canvas drawImage(image, source…, destination…)에 그대로 넘길 값 */
export type FaceCropDrawing = {
  sourceX: number
  sourceY: number
  sourceWidth: number
  sourceHeight: number
  destinationX: number
  destinationY: number
  destinationWidth: number
  destinationHeight: number
}

type FaceCropInput = {
  faceBox: FaceBoundingBox
  /** 얼굴 주변 여유 비율. 1.4면 얼굴 크기의 40%만큼 둘레를 더 보여 준다 */
  marginRatio: number
  imageWidth: number
  imageHeight: number
  /** 그릴 캔버스 한 변(px, 화면 배율을 곱한 값) */
  outputSize: number
}

// 얼굴 중심으로 얼굴보다 조금 큰 정사각형을 잘라 캔버스에 그릴 위치를 계산한다.
// 사진 밖으로 나가는 부분은 잘라 내고 그 비율만큼 캔버스 위치를 옮긴다(사파리는 사진 밖 영역을 넘기면 아무것도 안 그림)
export function calculateFaceCropDrawing({
  faceBox,
  marginRatio,
  imageWidth,
  imageHeight,
  outputSize,
}: FaceCropInput): FaceCropDrawing {
  const cropSide = Math.max(faceBox.w, faceBox.h) * marginRatio
  const cropLeft = faceBox.x + faceBox.w / 2 - cropSide / 2
  const cropTop = faceBox.y + faceBox.h / 2 - cropSide / 2
  const scale = outputSize / cropSide

  // 자를 영역과 사진이 겹치는 부분만 쓴다
  const sourceX = Math.max(0, cropLeft)
  const sourceY = Math.max(0, cropTop)
  const sourceRight = Math.min(imageWidth, cropLeft + cropSide)
  const sourceBottom = Math.min(imageHeight, cropTop + cropSide)
  const sourceWidth = Math.max(0, sourceRight - sourceX)
  const sourceHeight = Math.max(0, sourceBottom - sourceY)

  return {
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    destinationX: (sourceX - cropLeft) * scale,
    destinationY: (sourceY - cropTop) * scale,
    destinationWidth: sourceWidth * scale,
    destinationHeight: sourceHeight * scale,
  }
}

// 대표 얼굴을 그릴 수 있는지: 사진 주소와 크기가 있는 얼굴 위치가 모두 있어야 한다.
// 백엔드는 사진 주소를 아직 만들지 못했거나 대표 얼굴이 없으면 비워(null) 보낼 수 있다(셀카 매칭 PR)
export function isDrawableFace(
  imageUrl: string | null | undefined,
  faceBox: FaceBoundingBox | null | undefined,
): boolean {
  if (!imageUrl || !faceBox) return false
  return [faceBox.x, faceBox.y].every(Number.isFinite) && faceBox.w > 0 && faceBox.h > 0
}
