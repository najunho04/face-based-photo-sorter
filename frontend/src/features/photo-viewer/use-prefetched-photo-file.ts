import { useEffect, useState } from 'react'
import { fetchImageBlob, type SavablePhoto } from '@/features/photo-selection/photo-save-steps'

// ⑥에서 아이폰 [저장]을 한 번에 공유 시트로 열 수 있도록, 보고 있는 사진 파일을 미리 받아 둔다.
// (공유 시트는 누른 직후에만 열리므로, 누른 뒤에 받으면 늦어서 막힌다)
export function usePrefetchedPhotoFile(photo: SavablePhoto | undefined, isEnabled: boolean) {
  const [prefetched, setPrefetched] = useState<{ photoId: number; file: File } | null>(null)
  const photoId = photo?.photoId
  const imageUrl = photo ? (photo.downloadUrl ?? photo.url) : undefined
  const fileName = photo?.fileName

  useEffect(() => {
    if (!isEnabled || photoId === undefined || !imageUrl || !fileName) return
    const abortController = new AbortController()
    fetchImageBlob(imageUrl, abortController.signal)
      .then((imageBlob) =>
        setPrefetched({ photoId, file: new File([imageBlob], fileName, { type: 'image/jpeg' }) }),
      )
      // 미리 받기에 실패하면 누를 때 일반 저장 흐름(준비 → 버튼)으로 간다
      .catch(() => {})
    return () => abortController.abort()
  }, [isEnabled, photoId, imageUrl, fileName])

  return prefetched && prefetched.photoId === photoId ? prefetched.file : null
}
