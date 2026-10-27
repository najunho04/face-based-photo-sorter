// 사진 저장 방식 고르기(결정 기록 6단계): 아이폰·아이패드는 공유 시트의 '이미지 저장'으로만 사진 앱에 넣을 수 있어
// 공유 시트를 쓰고, 안드로이드·PC는 한 장씩 차례로 다운로드한다(안드로이드는 갤러리 Download 앨범에 보임)

export type SaveMethod = 'share-sheet' | 'download'

/** 안드로이드 크롬이 공유 시트로 한 번에 보낼 수 있는 사진 수(대략) */
export const shareBatchSize = 10

type SaveEnvironment = {
  userAgent: string
  /** 아이패드 'PC 화면' 모드는 맥과 같은 사용자 에이전트라 터치 지점 수로 구분한다 */
  maxTouchPoints: number
  /** 이 브라우저가 공유 시트로 파일을 보낼 수 있는지(navigator.canShare) */
  canShareFiles: boolean
}

// 아이폰·아이패드(PC 화면 모드 포함)인지 확인한다
export function isAppleMobileDevice({
  userAgent,
  maxTouchPoints,
}: Omit<SaveEnvironment, 'canShareFiles'>) {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}

export function chooseSaveMethod(environment: SaveEnvironment): SaveMethod {
  return isAppleMobileDevice(environment) && environment.canShareFiles ? 'share-sheet' : 'download'
}

// 목록을 정해진 크기로 나눈다(안드로이드에서 공유 시트를 여러 번 나눠 열 때)
export function splitIntoBatches<Item>(items: Item[], batchSize: number): Item[][] {
  const batches: Item[][] = []
  for (let start = 0; start < items.length; start += batchSize) {
    batches.push(items.slice(start, start + batchSize))
  }
  return batches
}

// 지금 브라우저가 공유 시트로 사진 파일을 보낼 수 있는지 확인한다
export function canShareImageFiles(): boolean {
  if (typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [new File([''], 'test.jpg', { type: 'image/jpeg' })] })
  } catch {
    return false
  }
}

// 지금 기기에 맞는 저장 방식
export function detectSaveMethod(): SaveMethod {
  return chooseSaveMethod({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    canShareFiles: canShareImageFiles(),
  })
}
