import { LoaderCircleIcon } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import { cn } from '@/shared/lib/utils'

type CameraPreviewProps = {
  videoRef: Ref<HTMLVideoElement>
  /** 앞 카메라는 거울처럼 좌우를 뒤집어 보여 준다(보내는 사진은 뒤집지 않음) */
  isMirrored: boolean
  isReady: boolean
  /** 카메라를 쓸 수 없을 때 미리보기 자리에 대신 보여 줄 안내 */
  unavailableNotice?: ReactNode
  className?: string
}

/** 촬영 안내 칩(시안 ③) */
const shootingTips = ['한 명만', '밝은 곳', '정면']

// 카메라 미리보기 (시안 ③·P3): 어두운 둥근 화면 + 얼굴 가이드 타원 + 안내 문구·칩
export function CameraPreview({
  videoRef,
  isMirrored,
  isReady,
  unavailableNotice,
  className,
}: CameraPreviewProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-3xl bg-dark-surface', className)}>
      {/* 아이폰에서 자동 재생하려면 muted·playsInline이 꼭 필요하다 */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={cn(
          'absolute inset-0 size-full object-cover transition-opacity duration-200',
          isMirrored && '-scale-x-100',
          isReady ? 'opacity-100' : 'opacity-0',
        )}
      />

      {unavailableNotice ? (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-6">
          {unavailableNotice}
        </div>
      ) : (
        <>
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <LoaderCircleIcon
                className="size-8 animate-spin text-dark-foreground-secondary"
                aria-label="카메라를 켜는 중"
              />
            </div>
          )}
          {/* 얼굴 가이드: 화면 크기에 맞춰 줄어드는 점선 타원 */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="aspect-[220/290] w-[56%] max-w-[220px] rounded-[50%] border-[3px] border-dashed border-white/85" />
          </div>
          <p className="absolute inset-x-0 top-6 text-center text-[17px] font-semibold text-white drop-shadow">
            얼굴을 원 안에 맞춰주세요
          </p>
          <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2">
            {shootingTips.map((tip) => (
              <span
                key={tip}
                className="rounded-full bg-black/45 px-3 py-1.5 text-[13px] text-white"
              >
                {tip}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
