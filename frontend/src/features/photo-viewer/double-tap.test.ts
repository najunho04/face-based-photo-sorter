import { describe, expect, it } from 'vitest'
import { createDoubleTapDetector } from '@/features/photo-viewer/double-tap'

// 손가락을 떼는 순간(위치·시각)과 누른 순간 정보를 간단히 만든다
function tap(x: number, y: number, time: number, pressDuration = 80, moveDistance = 0) {
  return { x, y, time, pressDuration, moveDistance }
}

describe('createDoubleTapDetector (아이폰은 두 번 탭에 dblclick을 보내지 않아 직접 판별)', () => {
  it('300ms 안에 같은 자리를 두 번 탭하면 두 번째에서 true', () => {
    const detector = createDoubleTapDetector()
    expect(detector.registerTap(tap(100, 100, 1000))).toBe(false)
    expect(detector.registerTap(tap(105, 98, 1200))).toBe(true)
  })

  it('간격이 너무 길면 두 번 탭이 아니다', () => {
    const detector = createDoubleTapDetector()
    detector.registerTap(tap(100, 100, 1000))
    expect(detector.registerTap(tap(100, 100, 1400))).toBe(false)
  })

  it('두 탭 위치가 멀면 두 번 탭이 아니다', () => {
    const detector = createDoubleTapDetector()
    detector.registerTap(tap(100, 100, 1000))
    expect(detector.registerTap(tap(200, 100, 1150))).toBe(false)
  })

  it('세 번째 탭은 새로 시작한다(두 번 탭 직후 바로 또 두 번 탭으로 세지 않음)', () => {
    const detector = createDoubleTapDetector()
    detector.registerTap(tap(100, 100, 1000))
    expect(detector.registerTap(tap(100, 100, 1150))).toBe(true)
    expect(detector.registerTap(tap(100, 100, 1300))).toBe(false)
    expect(detector.registerTap(tap(100, 100, 1450))).toBe(true)
  })

  it('끌거나(움직임 큼) 오래 누른 것은 탭이 아니라 앞의 탭도 지운다', () => {
    const detector = createDoubleTapDetector()
    detector.registerTap(tap(100, 100, 1000))
    expect(detector.registerTap(tap(100, 100, 1150, 80, 40))).toBe(false)
    expect(detector.registerTap(tap(100, 100, 1250))).toBe(false)

    const longPressDetector = createDoubleTapDetector()
    longPressDetector.registerTap(tap(100, 100, 1000))
    expect(longPressDetector.registerTap(tap(100, 100, 1250, 400))).toBe(false)
  })

  it('reset 하면 앞의 탭을 잊는다(두 손가락 확대가 끼어든 경우)', () => {
    const detector = createDoubleTapDetector()
    detector.registerTap(tap(100, 100, 1000))
    detector.reset()
    expect(detector.registerTap(tap(100, 100, 1100))).toBe(false)
  })
})
