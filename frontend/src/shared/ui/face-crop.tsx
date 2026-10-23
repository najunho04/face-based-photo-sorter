import { UserRoundIcon } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/lib/utils'

/** 원본 사진 안에서 얼굴 위치 (API의 bbox, 서버에 저장된 이미지 기준 픽셀) */
export type FaceBoundingBox = { x: number; y: number; w: number; h: number }

type FaceCropProps = {
  imageUrl: string
  faceBox: FaceBoundingBox
  /** 동그라미 지름(px). 후보 92, PC 후보 140, 사람별 사진 88 등 */
  size: number
  /** 얼굴 주변 여유 비율. 1.4면 얼굴 크기의 40%만큼 둘레를 더 보여 준다 */
  marginRatio?: number
  className?: string
}

// 서버가 잘린 얼굴 이미지를 주지 않으므로(원본 URL + bbox), CSS transform으로 얼굴 부분만 동그랗게 보여 준다.
// 원본의 전체 크기를 몰라도 되도록 이미지를 원래 크기로 두고 '옮긴 뒤 확대'한다.
export function FaceCrop({ imageUrl, faceBox, size, marginRatio = 1.4, className }: FaceCropProps) {
  // 불러오기 결과를 주소와 함께 기억한다. 주소가 바뀌면(만료 후 새 주소) 자동으로 '불러오는 중'으로 돌아간다
  const [loadResult, setLoadResult] = useState<{ url: string; status: 'loaded' | 'failed' }>()
  const loadState = loadResult?.url === imageUrl ? loadResult.status : 'loading'

  // 얼굴 중심을 기준으로, 얼굴보다 조금 큰 정사각형 영역을 잘라 낼 위치와 확대 비율을 계산한다
  const cropSide = Math.max(faceBox.w, faceBox.h) * marginRatio
  const cropLeft = faceBox.x + faceBox.w / 2 - cropSide / 2
  const cropTop = faceBox.y + faceBox.h / 2 - cropSide / 2
  const scale = size / cropSide

  return (
    <div
      className={cn('relative shrink-0 overflow-hidden rounded-full bg-placeholder', className)}
      style={{ width: size, height: size }}
    >
      {loadState === 'failed' ? (
        // 이미지 주소가 만료되었거나 불러오지 못하면 사람 모양 아이콘으로 대신한다
        <div className="flex size-full items-center justify-center">
          <UserRoundIcon className="size-1/2 text-text-muted" aria-hidden="true" />
        </div>
      ) : (
        <img
          src={imageUrl}
          alt=""
          decoding="async"
          onLoad={() => setLoadResult({ url: imageUrl, status: 'loaded' })}
          onError={() => setLoadResult({ url: imageUrl, status: 'failed' })}
          // max-w-none: Tailwind 기본값(max-width:100%)이 이미지를 줄여 좌표가 어긋나는 것을 막는다
          className="absolute top-0 left-0 max-w-none origin-top-left transition-opacity duration-200"
          style={{
            opacity: loadState === 'loaded' ? 1 : 0,
            transform: `scale(${scale}) translate(${-cropLeft}px, ${-cropTop}px)`,
          }}
        />
      )}
    </div>
  )
}
