import { useEffect, useRef, useState, type PointerEvent } from 'react'
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch'
import { createDoubleTapDetector } from '@/features/photo-viewer/double-tap'
import { reducedMotionMediaQuery, useMediaQuery } from '@/shared/lib/use-media-query'
import { cn } from '@/shared/lib/utils'

type ZoomablePhotoProps = {
  imageUrl: string
  alt: string
  /** 지금 보고 있는 사진인지. 다른 사진으로 넘어가면 확대를 원래대로 돌린다 */
  isActive: boolean
  /** 확대 여부가 바뀔 때 알린다(확대 중에는 좌우 넘기기를 멈추려고) */
  onZoomChange: (isZoomed: boolean) => void
  onImageError?: () => void
}

/** 두 번 탭·두 번 클릭으로 확대할 배율 */
const doubleTapScale = 2
/** 두 번 탭 확대·되돌리기 움직임 시간(ms) */
const doubleTapAnimationMilliseconds = 200
/** touchend가 오지 않는 기기에서 두 번 탭 확대를 대신 실행하기까지 기다리는 시간(ms) */
const touchEndFallbackMilliseconds = 300
/** 터치 뒤 이 시간 안에 오는 mousedown은 브라우저가 만든 가짜(호환용)로 본다(ms) */
const compatibilityMouseWindowMilliseconds = 1000

// ⑥ 사진 한 장: 두 손가락으로 확대·이동, 두 번 탭하면 2배 확대/원래대로(react-zoom-pan-pinch, 결정 기록 6단계).
// 두 번 탭은 라이브러리 대신 직접 판별한다(아이폰 사파리는 두 번 탭에 dblclick을 보내지 않음, 8단계 아이폰 확인)
export function ZoomablePhoto({
  imageUrl,
  alt,
  isActive,
  onZoomChange,
  onImageError,
}: ZoomablePhotoProps) {
  const transformRef = useRef<ReactZoomPanPinchRef>(null)
  const [isZoomed, setIsZoomed] = useState(false)
  const [loadedUrl, setLoadedUrl] = useState<string>()
  // 동작 줄이기가 켜져 있으면 확대·되돌리기·밀림 효과 없이 바로 바꾼다(라이브러리가 JS로 움직여 CSS 규칙이 안 먹음)
  const prefersReducedMotion = useMediaQuery(reducedMotionMediaQuery)
  const animationTime = prefersReducedMotion ? 0 : undefined
  const [doubleTapDetector] = useState(() => createDoubleTapDetector())
  // 지금 눌려 있는 손가락과 누른 시각·위치(두 손가락 확대가 끼면 탭으로 세지 않으려고)
  const activePointersRef = useRef(new Map<number, { x: number; y: number; time: number }>())
  // 마지막 입력이 터치였는지. 안드로이드는 두 번 탭에 dblclick도 보내므로 겹쳐 처리하지 않게 한다
  const lastPointerTypeRef = useRef<string>('mouse')
  // 두 번 탭으로 판별됐지만 아직 실행하지 않은 확대·되돌리기(라이브러리가 touchend를 처리한 뒤 실행)
  const pendingToggleRef = useRef<{ x: number; y: number; fallbackTimer: number }>(undefined)
  // 마지막으로 손가락을 뗀 시각(터치 뒤에 오는 가짜 mousedown을 알아보려고)
  const lastTouchUpTimeRef = useRef(Number.NEGATIVE_INFINITY)

  // 누른 자리를 중심으로 2배 확대하고, 이미 확대돼 있으면 원래대로 돌린다
  function toggleZoomAt(clientX: number, clientY: number) {
    const transform = transformRef.current
    const wrapper = transform?.instance.wrapperComponent
    if (!transform || !wrapper) return
    const time = prefersReducedMotion ? 0 : doubleTapAnimationMilliseconds
    const { scale, positionX, positionY } = transform.state
    if (scale > 1.01) {
      transform.resetTransform(time)
      // 안전장치: 되돌리기 애니메이션이 다른 입력에 끊겨도 끝날 시간이 지나면 원래 크기로 맞춘다
      window.setTimeout(() => {
        if (transform.state.scale > 1.01) transform.resetTransform(0)
      }, time + 80)
      return
    }
    // 누른 점이 확대 뒤에도 손가락 아래 그대로 있도록 위치를 옮긴다
    const wrapperRect = wrapper.getBoundingClientRect()
    const pointX = clientX - wrapperRect.left
    const pointY = clientY - wrapperRect.top
    const scaleRatio = doubleTapScale / scale
    transform.setTransform(
      pointX - (pointX - positionX) * scaleRatio,
      pointY - (pointY - positionY) * scaleRatio,
      doubleTapScale,
      time,
    )
  }

  function handlePointerDown(pointerEvent: PointerEvent) {
    lastPointerTypeRef.current = pointerEvent.pointerType
    activePointersRef.current.set(pointerEvent.pointerId, {
      x: pointerEvent.clientX,
      y: pointerEvent.clientY,
      time: pointerEvent.timeStamp,
    })
    // 두 번째 손가락이 닿으면 두 손가락 확대이므로 탭 기록을 지운다
    if (activePointersRef.current.size > 1) doubleTapDetector.reset()
  }

  function handlePointerUp(pointerEvent: PointerEvent) {
    const pressed = activePointersRef.current.get(pointerEvent.pointerId)
    const wasMultiTouch = activePointersRef.current.size > 1
    activePointersRef.current.delete(pointerEvent.pointerId)
    if (pointerEvent.pointerType === 'touch') lastTouchUpTimeRef.current = pointerEvent.timeStamp
    if (pointerEvent.pointerType !== 'touch' || !pressed || wasMultiTouch) return
    const isDoubleTap = doubleTapDetector.registerTap({
      x: pointerEvent.clientX,
      y: pointerEvent.clientY,
      time: pointerEvent.timeStamp,
      pressDuration: pointerEvent.timeStamp - pressed.time,
      moveDistance: Math.hypot(pointerEvent.clientX - pressed.x, pointerEvent.clientY - pressed.y),
    })
    if (!isDoubleTap) return
    // 확대 중에는 라이브러리가 touchend에서 '끌기 끝'을 처리하므로, 그 처리가 끝난 뒤에 실행한다
    const x = pointerEvent.clientX
    const y = pointerEvent.clientY
    const fallbackTimer = window.setTimeout(runPendingToggle, touchEndFallbackMilliseconds)
    pendingToggleRef.current = { x, y, fallbackTimer }
  }

  // 미뤄 둔 두 번 탭 확대·되돌리기를 한 번만 실행한다(touchend 또는 대비 타이머 중 먼저 오는 쪽)
  function runPendingToggle() {
    const pendingToggle = pendingToggleRef.current
    if (!pendingToggle) return
    pendingToggleRef.current = undefined
    window.clearTimeout(pendingToggle.fallbackTimer)
    toggleZoomAt(pendingToggle.x, pendingToggle.y)
  }

  // 화면을 떠나면 미뤄 둔 타이머를 정리한다
  useEffect(
    () => () => {
      if (pendingToggleRef.current) window.clearTimeout(pendingToggleRef.current.fallbackTimer)
    },
    [],
  )

  // 다른 사진으로 넘어가면 확대를 풀어 둔다(다시 돌아왔을 때 원래 크기로 보이게)
  useEffect(() => {
    if (!isActive) transformRef.current?.resetTransform(0)
  }, [isActive])

  return (
    <div
      className="size-full"
      // 라이브러리가 이벤트를 멈춰도 받도록 capture 단계에서 듣는다
      onPointerDownCapture={handlePointerDown}
      onPointerUpCapture={handlePointerUp}
      // 아이폰은 터치 뒤에 막아도 가짜 mousedown을 보내고, 라이브러리가 이를 window에서 받아 '끌기 시작'으로
      // 처리하며 확대·되돌리기 애니메이션을 취소한다(8단계 아이폰 기록). 터치 직후의 mousedown은 여기서 멈춘다
      onMouseDownCapture={(mouseEvent) => {
        if (
          mouseEvent.timeStamp - lastTouchUpTimeRef.current <
          compatibilityMouseWindowMilliseconds
        ) {
          mouseEvent.stopPropagation()
        }
      }}
      // 라이브러리(안쪽 요소)가 touchend를 처리한 다음 이 바깥 요소에 올라오므로 여기서 실행한다.
      // 기본 동작을 막아 가짜 마우스 이벤트를 줄인다(안드로이드는 따르고, 아이폰은 무시해서 위 mousedown 처리가 필요)
      onTouchEnd={(touchEvent) => {
        if (!pendingToggleRef.current) return
        if (touchEvent.cancelable) touchEvent.preventDefault()
        runPendingToggle()
      }}
      onPointerCancelCapture={(pointerEvent) => {
        activePointersRef.current.delete(pointerEvent.pointerId)
        doubleTapDetector.reset()
      }}
      // PC 마우스 두 번 클릭. 터치에서 온 dblclick(안드로이드)은 위에서 이미 처리했으므로 무시한다
      onDoubleClick={(mouseEvent) => {
        if (lastPointerTypeRef.current !== 'touch')
          toggleZoomAt(mouseEvent.clientX, mouseEvent.clientY)
      }}
    >
      <TransformWrapper
        ref={transformRef}
        minScale={1}
        maxScale={4}
        // 라이브러리의 두 번 클릭은 끄고 위에서 직접 처리한다
        doubleClick={{ disabled: true }}
        // 확대하지 않았을 때는 끌기를 넘기기(Embla)에 양보한다
        panning={{ disabled: !isZoomed, velocityDisabled: true }}
        wheel={{ step: 0.2 }}
        zoomAnimation={{ disabled: prefersReducedMotion }}
        autoAlignment={{ animationTime, velocityAlignmentTime: animationTime }}
        onTransform={(_, state) => {
          const nextIsZoomed = state.scale > 1.01
          if (nextIsZoomed !== isZoomed) {
            setIsZoomed(nextIsZoomed)
            onZoomChange(nextIsZoomed)
          }
        }}
      >
        <TransformComponent
          wrapperClass="!size-full"
          contentClass="!size-full flex items-center justify-center"
        >
          <img
            src={imageUrl}
            alt={alt}
            decoding="async"
            draggable={false}
            onLoad={() => setLoadedUrl(imageUrl)}
            onError={onImageError}
            className={cn(
              'max-h-full max-w-full object-contain transition-opacity duration-200 select-none',
              loadedUrl === imageUrl ? 'opacity-100' : 'opacity-0',
            )}
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}
