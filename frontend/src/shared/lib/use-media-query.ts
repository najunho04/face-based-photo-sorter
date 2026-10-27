import { useSyncExternalStore } from 'react'

/** 명세서 7장의 PC 기준 너비(Tailwind lg와 같음) */
export const desktopMediaQuery = '(min-width: 1024px)'

/** 기기에서 '동작 줄이기'를 켰는지(명세서 6장: 켜면 모든 움직임을 끈다) */
export const reducedMotionMediaQuery = '(prefers-reduced-motion: reduce)'

// 화면 너비 조건(예: PC 이상)을 지금 값으로 알려 주고, 창 크기가 바뀌면 다시 그린다.
// CSS만으로 안 되는 경우(FaceCrop처럼 크기를 숫자로 계산하는 부품)에만 쓴다
export function useMediaQuery(mediaQuery: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mediaQueryList = window.matchMedia(mediaQuery)
      mediaQueryList.addEventListener('change', onChange)
      return () => mediaQueryList.removeEventListener('change', onChange)
    },
    () => window.matchMedia(mediaQuery).matches,
  )
}
