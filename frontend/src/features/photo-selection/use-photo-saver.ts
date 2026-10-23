import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  prepareShareFiles,
  runSequentially,
  startPhotoDownload,
  type SavablePhoto,
} from '@/features/photo-selection/photo-save-steps'
import {
  canShareImageFiles,
  detectSaveMethod,
  isAppleMobileDevice,
  shareBatchSize,
  splitIntoBatches,
  type SaveMethod,
} from '@/features/photo-selection/save-method'

/** 저장(사진 앱·다운로드)인지, 공유(다른 앱으로 보내기)인지 */
export type SavePurpose = 'save' | 'share'

/** ⑤-2 저장 진행 시트에 보여 줄 상태 */
export type SaveProgress =
  | { status: 'idle' }
  | {
      status: 'working'
      purpose: SavePurpose
      method: SaveMethod
      completedCount: number
      totalCount: number
    }
  | {
      status: 'ready-to-share'
      purpose: SavePurpose
      /** 공유 시트를 몇 번에 나눠 열지(안드로이드 공유는 10장씩) */
      batches: File[][]
      batchIndex: number
    }
  | { status: 'failed'; purpose: SavePurpose; photos: SavablePhoto[] }

// 사진 저장·공유를 진행한다(결정 기록 6단계).
// - 다운로드: 한 장씩 차례로 내려받고 진행을 보여 준다
// - 공유 시트: 사진 파일을 모두 받아 둔 뒤, 사용자가 [사진 앱에 저장하기]를 한 번 더 눌러야 연다(브라우저 제한)
export function usePhotoSaver() {
  const [progress, setProgress] = useState<SaveProgress>({ status: 'idle' })
  const abortControllerRef = useRef<AbortController | null>(null)

  const downloadPhotos = useCallback(async (photos: SavablePhoto[], purpose: SavePurpose) => {
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    const totalCount = photos.length
    setProgress({ status: 'working', purpose, method: 'download', completedCount: 0, totalCount })
    const completedCount = await runSequentially(
      photos,
      async (photo) => startPhotoDownload(photo),
      {
        signal: abortController.signal,
        onProgress: (count) =>
          setProgress({
            status: 'working',
            purpose,
            method: 'download',
            completedCount: count,
            totalCount,
          }),
      },
    )
    setProgress({ status: 'idle' })
    if (completedCount > 0) toast.success(`사진 ${completedCount}장을 저장했어요`)
  }, [])

  const preparePhotosForShareSheet = useCallback(
    async (photos: SavablePhoto[], purpose: SavePurpose) => {
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      const totalCount = photos.length
      setProgress({
        status: 'working',
        purpose,
        method: 'share-sheet',
        completedCount: 0,
        totalCount,
      })
      try {
        const files = await prepareShareFiles(photos, {
          signal: abortController.signal,
          gapMilliseconds: 0,
          onProgress: (count) =>
            setProgress({
              status: 'working',
              purpose,
              method: 'share-sheet',
              completedCount: count,
              totalCount,
            }),
        })
        if (abortController.signal.aborted) return
        // 아이폰은 한 번에, 그 밖(안드로이드 공유)은 10장씩 나눠 연다
        const isAppleMobile = isAppleMobileDevice({
          userAgent: navigator.userAgent,
          maxTouchPoints: navigator.maxTouchPoints,
        })
        setProgress({
          status: 'ready-to-share',
          purpose,
          batches: isAppleMobile ? [files] : splitIntoBatches(files, shareBatchSize),
          batchIndex: 0,
        })
      } catch {
        if (!abortController.signal.aborted) setProgress({ status: 'failed', purpose, photos })
      }
    },
    [],
  )

  /** 저장·공유 시작. 저장은 기기에 맞는 방식, 공유는 공유 시트(안 되면 다운로드) */
  const start = useCallback(
    (photos: SavablePhoto[], purpose: SavePurpose) => {
      if (photos.length === 0) return
      const method: SaveMethod =
        purpose === 'save' ? detectSaveMethod() : canShareImageFiles() ? 'share-sheet' : 'download'
      if (method === 'download') void downloadPhotos(photos, purpose)
      else void preparePhotosForShareSheet(photos, purpose)
    },
    [downloadPhotos, preparePhotosForShareSheet],
  )

  /** [사진 앱에 저장하기]/[공유하기]를 눌렀을 때. 반드시 버튼 누름 안에서 불러야 공유 시트가 열린다 */
  const openShareSheet = useCallback(async () => {
    if (progress.status !== 'ready-to-share') return
    const { batches, batchIndex, purpose } = progress
    try {
      await navigator.share({ files: batches[batchIndex] })
    } catch (error) {
      // 공유 시트를 그냥 닫은 경우: 다시 누를 수 있게 그대로 둔다
      if (error instanceof DOMException && error.name === 'AbortError') return
      setProgress({ status: 'idle' })
      toast.error('공유 화면을 열지 못했어요. 다시 시도해주세요.')
      return
    }
    if (batchIndex + 1 < batches.length) {
      setProgress({ ...progress, batchIndex: batchIndex + 1 })
      return
    }
    setProgress({ status: 'idle' })
    const totalCount = batches.reduce((sum, batch) => sum + batch.length, 0)
    toast.success(purpose === 'save' ? `사진 ${totalCount}장을 저장했어요` : '사진을 보냈어요')
  }, [progress])

  /** 준비에 실패했을 때 다운로드로 대신 저장한다(사진 저장소 CORS가 막힌 경우 등) */
  const downloadInstead = useCallback(() => {
    if (progress.status === 'failed') void downloadPhotos(progress.photos, progress.purpose)
  }, [progress, downloadPhotos])

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    setProgress({ status: 'idle' })
  }, [])

  return { progress, start, openShareSheet, downloadInstead, cancel }
}
