// 사진을 긴 변 기준으로 줄여 JPG로 만든다. 셀카(1024px)와 관리자 업로드(2000px, 7단계)가 같이 쓴다.

/** 긴 변이 maxLongEdge를 넘지 않도록 비율을 지켜 줄인 크기. 이미 작으면 그대로 둔다 */
export function calculateResizedDimensions(
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxLongEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

type DrawableImage = {
  /** 캔버스에 그릴 수 있는 이미지(비디오 프레임, ImageBitmap 등) */
  source: CanvasImageSource
  width: number
  height: number
}

// 그릴 수 있는 이미지를 줄여 JPG Blob으로 만든다(브라우저 전용, 캔버스 사용)
export function drawResizedJpeg(
  { source, width, height }: DrawableImage,
  maxLongEdge: number,
  quality = 0.85,
): Promise<Blob> {
  const resizedDimensions = calculateResizedDimensions(width, height, maxLongEdge)
  const canvas = document.createElement('canvas')
  canvas.width = resizedDimensions.width
  canvas.height = resizedDimensions.height
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('이미지를 그릴 수 없어요'))
  context.drawImage(source, 0, 0, resizedDimensions.width, resizedDimensions.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했어요'))),
      'image/jpeg',
      quality,
    )
  })
}

// 고른 사진 파일(갤러리·기본 카메라 앱)을 줄여 JPG로 만든다. 사진의 회전 정보(EXIF)를 반영해 바로 세운다
export async function resizeImageFileToJpeg(
  file: Blob,
  maxLongEdge: number,
  quality = 0.85,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    return await drawResizedJpeg(
      { source: bitmap, width: bitmap.width, height: bitmap.height },
      maxLongEdge,
      quality,
    )
  } finally {
    bitmap.close()
  }
}
