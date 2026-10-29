/** 토스트를 얼마나 위로 올릴지 담는 CSS 변수. Toaster의 아래 여백 계산에서 읽는다(shared/ui/sonner.tsx) */
export const toastClearanceVariableName = '--toast-bottom-clearance'

// 아래 고정 막대 높이를 문서 최상단 CSS 변수로 적어 둔다. 토스트가 막대를 덮지 않고 그 위에 뜨게 하려는 것
export function setToastClearance(heightPixels: number) {
  if (!Number.isFinite(heightPixels) || heightPixels <= 0) {
    clearToastClearance()
    return
  }
  // 소수점 높이는 올림해 토스트가 막대 위쪽 선에 걸치지 않게 한다
  document.documentElement.style.setProperty(
    toastClearanceVariableName,
    `${Math.ceil(heightPixels)}px`,
  )
}

// 막대가 없는 화면으로 가면 지워서 토스트가 원래 자리(화면 아래)로 돌아오게 한다
export function clearToastClearance() {
  document.documentElement.style.removeProperty(toastClearanceVariableName)
}

// 아래 고정 막대의 ref로 그대로 넘긴다(ref={observeToastClearance}). 막대가 화면에 붙으면 높이를 적고,
// 높이가 바뀌면(선택 모드 전환, PC에서 숨김 등) 다시 적고, 막대가 사라지면 지운다(React 19 ref 정리 함수)
export function observeToastClearance(bar: HTMLElement | null) {
  if (!bar) return
  const update = () => setToastClearance(bar.getBoundingClientRect().height)
  update()
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
  observer?.observe(bar)
  return () => {
    observer?.disconnect()
    clearToastClearance()
  }
}
