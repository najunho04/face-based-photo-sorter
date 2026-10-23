import { useCallback, useState } from 'react'

// ⑤-1 선택 모드 상태: 선택 중인지, 어떤 사진을 골랐는지
export function usePhotoSelection() {
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<number[]>([])

  const toggle = useCallback((photoId: number) => {
    setSelectedPhotoIds((current) =>
      current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId],
    )
  }, [])

  return {
    isSelecting,
    selectedPhotoIds,
    /** [선택]을 누르거나 사진을 길게 눌렀을 때. 길게 누른 사진은 바로 고른 상태로 시작한다 */
    enter: useCallback((initialPhotoId?: number) => {
      setIsSelecting(true)
      setSelectedPhotoIds(initialPhotoId === undefined ? [] : [initialPhotoId])
    }, []),
    /** [취소]: 선택 모드를 끝내고 고른 것도 지운다 */
    exit: useCallback(() => {
      setIsSelecting(false)
      setSelectedPhotoIds([])
    }, []),
    toggle,
    selectAll: useCallback((photoIds: number[]) => setSelectedPhotoIds(photoIds), []),
    clear: useCallback(() => setSelectedPhotoIds([]), []),
  }
}
