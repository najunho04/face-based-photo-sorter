// 사진 저장의 작은 단계들: 한 장씩 차례로 처리하기, 공유 시트에 넘길 파일 준비하기, 다운로드 시작하기

/** 저장에 필요한 사진 정보. ⑦ 전체 사진에는 저장 주소(downloadUrl)가 없어 보기 주소를 쓴다 */
export type SavablePhoto = {
  photoId: number
  fileName: string
  url: string
  downloadUrl?: string
}

type SequenceOptions = {
  /** 몇 장째 끝났는지 알린다(진행 막대) */
  onProgress?: (completedCount: number) => void
  signal?: AbortSignal
  /** 다음 장으로 넘어가기 전 쉬는 시간. 브라우저가 연속 다운로드를 막지 않도록 둔다 */
  gapMilliseconds?: number
}

// 항목을 하나씩 순서대로 처리한다. 취소되면 남은 항목은 건너뛰고, 끝낸 개수를 돌려준다
export async function runSequentially<Item>(
  items: Item[],
  task: (item: Item, signal?: AbortSignal) => Promise<void>,
  { onProgress, signal, gapMilliseconds = 400 }: SequenceOptions = {},
): Promise<number> {
  let completedCount = 0
  for (const item of items) {
    if (signal?.aborted) break
    await task(item, signal)
    completedCount += 1
    onProgress?.(completedCount)
    if (signal?.aborted) break
    if (gapMilliseconds > 0 && completedCount < items.length) {
      await new Promise((resolve) => setTimeout(resolve, gapMilliseconds))
    }
  }
  return completedCount
}

// 파일 이름이 .jpg로 끝나게 맞춘다(공유 시트·사진 앱이 형식을 알아보도록)
function toJpegFileName(fileName: string): string {
  return /\.jpe?g$/i.test(fileName) ? fileName : `${fileName.replace(/\.[^.]+$/, '')}.jpg`
}

// 사진 주소에서 이미지를 받아 Blob으로 돌려준다(실제 서버는 사진 저장소 CORS 허용이 필요, 계획 문서 8장)
export async function fetchImageBlob(imageUrl: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(imageUrl, { signal })
  if (!response.ok) throw new Error(`사진을 받지 못했어요 (${response.status})`)
  return response.blob()
}

// 공유 시트에 넘길 사진 파일들을 차례로 받아 만든다
export async function prepareShareFiles(
  photos: SavablePhoto[],
  {
    fetchImage = fetchImageBlob,
    ...sequenceOptions
  }: SequenceOptions & { fetchImage?: (imageUrl: string, signal?: AbortSignal) => Promise<Blob> },
): Promise<File[]> {
  const files: File[] = []
  await runSequentially(
    photos,
    async (photo, signal) => {
      const imageBlob = await fetchImage(photo.downloadUrl ?? photo.url, signal)
      files.push(new File([imageBlob], toJpegFileName(photo.fileName), { type: 'image/jpeg' }))
    },
    sequenceOptions,
  )
  return files
}

// 사진 한 장을 다운로드한다. 저장 주소는 서버가 '파일로 받기' 헤더를 붙여 주므로 링크를 누른 것처럼 연다
export function startPhotoDownload(photo: SavablePhoto): void {
  const link = document.createElement('a')
  link.href = photo.downloadUrl ?? photo.url
  link.download = toJpegFileName(photo.fileName)
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
}
