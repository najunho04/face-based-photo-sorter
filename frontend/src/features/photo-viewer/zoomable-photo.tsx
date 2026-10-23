import { useEffect, useRef, useState } from 'react'
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch'
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

// ⑥ 사진 한 장: 두 손가락으로 확대·이동, 두 번 탭하면 2배 확대/원래대로(react-zoom-pan-pinch, 결정 기록 6단계)
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

  // 다른 사진으로 넘어가면 확대를 풀어 둔다(다시 돌아왔을 때 원래 크기로 보이게)
  useEffect(() => {
    if (!isActive) transformRef.current?.resetTransform(0)
  }, [isActive])

  return (
    <TransformWrapper
      ref={transformRef}
      minScale={1}
      maxScale={4}
      doubleClick={{ mode: 'toggle', step: 1, animationTime }}
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
  )
}
