import { useSyncExternalStore } from 'react'

// 탭이 화면에 보이는지 알려 준다. 카메라처럼 숨겨진 동안 꺼 두어야 하는 기능에 쓴다
export function usePageVisibility(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener('visibilitychange', onChange)
      return () => document.removeEventListener('visibilitychange', onChange)
    },
    () => document.visibilityState === 'visible',
  )
}
