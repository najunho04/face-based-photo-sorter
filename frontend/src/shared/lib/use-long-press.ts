import { useCallback, useRef, type PointerEvent } from 'react'

/** 이 시간 이상 누르고 있으면 길게 누른 것으로 본다 */
const longPressMilliseconds = 500
/** 누른 채 이만큼 움직이면(스크롤) 길게 누르기를 취소한다 */
const moveTolerancePixels = 10

// 길게 누르기: 휴대폰에서 사진을 길게 누르면 선택 모드로 들어가는 보조 동작(⑤-1).
// 길게 누른 뒤 손을 떼면 생기는 클릭(링크 이동)은 막는다
export function useLongPress(onLongPress: () => void) {
  const timerRef = useRef<number | null>(null)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)
  const didLongPressRef = useRef(false)

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  return {
    onPointerDown: (pointerEvent: PointerEvent) => {
      didLongPressRef.current = false
      startPointRef.current = { x: pointerEvent.clientX, y: pointerEvent.clientY }
      cancelTimer()
      timerRef.current = window.setTimeout(() => {
        didLongPressRef.current = true
        onLongPress()
      }, longPressMilliseconds)
    },
    onPointerMove: (pointerEvent: PointerEvent) => {
      const startPoint = startPointRef.current
      if (!startPoint) return
      const movedDistance = Math.hypot(
        pointerEvent.clientX - startPoint.x,
        pointerEvent.clientY - startPoint.y,
      )
      if (movedDistance > moveTolerancePixels) cancelTimer()
    },
    onPointerUp: cancelTimer,
    onPointerCancel: cancelTimer,
    onPointerLeave: cancelTimer,
    // 길게 누른 뒤 따라오는 클릭은 무시한다(사진이 열리지 않게)
    onClickCapture: (clickEvent: { preventDefault: () => void; stopPropagation: () => void }) => {
      if (!didLongPressRef.current) return
      clickEvent.preventDefault()
      clickEvent.stopPropagation()
      didLongPressRef.current = false
    },
    // 아이폰·안드로이드의 길게 누르기 메뉴(이미지 저장 등)가 뜨지 않게 한다
    onContextMenu: (contextMenuEvent: { preventDefault: () => void }) =>
      contextMenuEvent.preventDefault(),
  }
}
