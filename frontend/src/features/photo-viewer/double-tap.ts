/** 손가락을 뗀 순간의 탭 정보 */
export type TapRecord = {
  x: number
  y: number
  /** 뗀 시각(ms) */
  time: number
  /** 누르고 있던 시간(ms) */
  pressDuration: number
  /** 누른 자리에서 움직인 거리(px) */
  moveDistance: number
}

type DoubleTapOptions = {
  /** 두 탭 사이 최대 간격 */
  maxIntervalMilliseconds?: number
  /** 두 탭 위치의 최대 거리 */
  maxDistancePixels?: number
  /** 이보다 오래 누르면 탭이 아니다(길게 누르기) */
  maxPressMilliseconds?: number
  /** 이보다 많이 움직이면 탭이 아니다(끌기) */
  maxMovePixels?: number
}

// 아이폰 사파리는 두 번 탭에 dblclick을 보내지 않아(react-zoom-pan-pinch의 doubleClick이 안 먹음) 직접 판별한다.
// 손가락을 뗄 때마다 registerTap을 부르면, 두 번째 탭이면 true를 돌려준다
export function createDoubleTapDetector({
  maxIntervalMilliseconds = 300,
  maxDistancePixels = 30,
  maxPressMilliseconds = 250,
  maxMovePixels = 10,
}: DoubleTapOptions = {}) {
  let previousTap: TapRecord | undefined

  return {
    registerTap(tap: TapRecord): boolean {
      // 끌기·길게 누르기는 탭이 아니므로 앞의 탭까지 잊는다
      if (tap.pressDuration > maxPressMilliseconds || tap.moveDistance > maxMovePixels) {
        previousTap = undefined
        return false
      }
      const isDoubleTap =
        previousTap !== undefined &&
        tap.time - previousTap.time <= maxIntervalMilliseconds &&
        Math.hypot(tap.x - previousTap.x, tap.y - previousTap.y) <= maxDistancePixels
      // 두 번 탭이 되면 처음부터 다시 센다(세 번째 탭이 또 두 번 탭이 되지 않게)
      previousTap = isDoubleTap ? undefined : tap
      return isDoubleTap
    },
    // 두 손가락 확대처럼 탭이 아닌 동작이 끼어들면 잊는다
    reset() {
      previousTap = undefined
    },
  }
}
