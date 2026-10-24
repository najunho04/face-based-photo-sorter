import { UserRoundIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createConcurrencyLimiter } from '@/shared/lib/concurrency-limiter'
import { calculateFaceCropDrawing, type FaceBoundingBox } from '@/shared/lib/face-crop-geometry'
import { cn } from '@/shared/lib/utils'

export type { FaceBoundingBox }

type FaceCropProps = {
  imageUrl: string
  faceBox: FaceBoundingBox
  /** 동그라미 지름(px). 후보 92, PC 후보 140, 사람별 사진 88 등 */
  size: number
  /** 얼굴 주변 여유 비율. 1.4면 얼굴 크기의 40%만큼 둘레를 더 보여 준다 */
  marginRatio?: number
  /** 이미지를 불러오지 못했을 때(주소 만료 403 등) 알린다. 목록을 다시 받아 새 주소로 바꾸는 데 쓴다 */
  onImageError?: () => void
  className?: string
}

/** 화면에 들어오기 이만큼 전에 미리 불러온다 */
const preloadMargin = '200px'

/** 대표 얼굴 원본을 동시에 받아 펼치는 최대 수. 모든 FaceCrop이 함께 쓴다 */
const faceDecodeLimiter = createConcurrencyLimiter(4)

// 서버가 잘린 얼굴 이미지를 주지 않으므로(원본 URL + bbox), 원본을 받아 얼굴 둘레만 작은 캔버스에 그려 동그랗게 보여 준다.
// 원본을 화면에 그대로 두고 CSS로 줄이면 아이폰 사파리가 원본 크기 레이어를 얼굴마다 들고 있다가
// 메모리가 모자라 일부를 비워 버린다(8단계 아이폰 확인). 캔버스는 지름×화면 배율 크기만 남는다
export function FaceCrop({
  imageUrl,
  faceBox,
  size,
  marginRatio = 1.4,
  onImageError,
  className,
}: FaceCropProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // 화면 근처에 온 적이 있는지. IntersectionObserver가 없는 환경은 바로 불러온다
  const [isNearViewport, setIsNearViewport] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )
  // 그리기 결과를 주소와 함께 기억한다. 주소가 바뀌면(만료 후 새 주소) 자동으로 '불러오는 중'으로 돌아간다
  const [loadResult, setLoadResult] = useState<{ url: string; status: 'loaded' | 'failed' }>()
  const loadState = loadResult?.url === imageUrl ? loadResult.status : 'loading'
  // 오류 알림은 최신 함수를 쓰되, 바뀌어도 다시 불러오지 않게 ref로 둔다
  const onImageErrorRef = useRef(onImageError)
  useEffect(() => {
    onImageErrorRef.current = onImageError
  }, [onImageError])

  // 썸네일이 없어 원본을 받으므로, 화면 가까이 온 얼굴만 불러와 데이터를 아낀다
  useEffect(() => {
    const container = containerRef.current
    if (isNearViewport || !container) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setIsNearViewport(true)
      },
      { rootMargin: preloadMargin },
    )
    observer.observe(container)
    return () => observer.disconnect()
  }, [isNearViewport])

  // 원본을 받아 얼굴 둘레만 캔버스에 그리고, 원본은 바로 놓아준다.
  // 동시에 펼치는 원본 수는 제한한다(2000px 한 장을 펼치면 약 12MB, 첫 화면 얼굴 18개면 200MB 이상)
  useEffect(() => {
    if (!isNearViewport) return
    let isCancelled = false
    let releaseSlot = () => {}
    let stopLoading = () => {}

    // 받은 원본에서 얼굴 둘레를 잘라 캔버스에 그린다
    const drawFaceCrop = (image: HTMLImageElement) => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (isCancelled || !canvas || !context) return
      // 화면 배율(레티나 2~3배)만큼 크게 그려야 흐리지 않다
      const outputSize = Math.round(size * Math.min(window.devicePixelRatio || 1, 3))
      canvas.width = outputSize
      canvas.height = outputSize
      const drawing = calculateFaceCropDrawing({
        faceBox,
        marginRatio,
        imageWidth: image.naturalWidth,
        imageHeight: image.naturalHeight,
        outputSize,
      })
      if (drawing.sourceWidth > 0 && drawing.sourceHeight > 0) {
        context.drawImage(
          image,
          drawing.sourceX,
          drawing.sourceY,
          drawing.sourceWidth,
          drawing.sourceHeight,
          drawing.destinationX,
          drawing.destinationY,
          drawing.destinationWidth,
          drawing.destinationHeight,
        )
      }
      setLoadResult({ url: imageUrl, status: 'loaded' })
    }

    void faceDecodeLimiter.run(
      () =>
        new Promise<void>((resolve) => {
          releaseSlot = resolve
          // 차례를 기다리는 동안 화면을 떠났으면 불러오지 않는다
          if (isCancelled) {
            resolve()
            return
          }
          const image = new Image()
          image.decoding = 'async'
          // 받은 원본을 미리 해독해 둔 뒤 그린다. 바로 drawImage를 부르면 2000px 사진 해독을 메인 스레드에서
          // 그 자리에서 하느라 얼굴이 여럿 그려질 때 스크롤이 끊긴다(decode를 못 하는 경우에도 그리기는 한다)
          image.onload = () => {
            void image
              .decode()
              .catch(() => {})
              .then(() => {
                drawFaceCrop(image)
                resolve()
              })
          }
          image.onerror = () => {
            if (!isCancelled) {
              setLoadResult({ url: imageUrl, status: 'failed' })
              onImageErrorRef.current?.()
            }
            resolve()
          }
          stopLoading = () => {
            image.onload = null
            image.onerror = null
            image.src = ''
          }
          image.src = imageUrl
        }),
    )

    // 화면을 떠나거나 주소가 바뀌면 불러오기를 멈추고 자리를 바로 비운다
    return () => {
      isCancelled = true
      stopLoading()
      releaseSlot()
    }
    // faceBox는 객체라 매번 새로 오므로 숫자 값으로 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNearViewport, imageUrl, faceBox.x, faceBox.y, faceBox.w, faceBox.h, size, marginRatio])

  return (
    <div
      ref={containerRef}
      className={cn('relative shrink-0 overflow-hidden rounded-full bg-placeholder', className)}
      style={{ width: size, height: size }}
    >
      {loadState === 'failed' ? (
        // 이미지 주소가 만료되었거나 불러오지 못하면 사람 모양 아이콘으로 대신한다
        <div className="flex size-full items-center justify-center">
          <UserRoundIcon className="size-1/2 text-text-muted" aria-hidden="true" />
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="size-full transition-opacity duration-200"
          style={{ opacity: loadState === 'loaded' ? 1 : 0 }}
        />
      )}
    </div>
  )
}
