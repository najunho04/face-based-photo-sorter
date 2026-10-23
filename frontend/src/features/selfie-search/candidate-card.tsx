import { CheckIcon } from 'lucide-react'
import type { Person } from '@/entities/person/person-types'
import { desktopMediaQuery, useMediaQuery } from '@/shared/lib/use-media-query'
import { cn } from '@/shared/lib/utils'
import { FaceCrop } from '@/shared/ui/face-crop'

type CandidateCardProps = {
  candidate: Person
  /** 비슷한 순서 번호(1부터). 화면 낭독기용 이름에 쓴다 */
  order: number
  isSelected: boolean
  onToggle: () => void
  onImageError?: () => void
}

// ④ 후보 한 명 (시안 ④ 휴대폰 92px, P4 PC 140px 카드). 눌러서 고르고 다시 눌러서 뺀다(여러 명 선택)
export function CandidateCard({
  candidate,
  order,
  isSelected,
  onToggle,
  onImageError,
}: CandidateCardProps) {
  const isDesktop = useMediaQuery(desktopMediaQuery)
  // 360px보다 좁은 휴대폰에서는 세 명이 한 줄에 들어가도록 얼굴을 줄인다
  const isNarrowPhone = !useMediaQuery('(min-width: 360px)')
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={`후보 ${order}, 사진 ${candidate.photoCount}장`}
      onClick={onToggle}
      className={cn(
        'relative flex w-full flex-col items-center gap-2.5 rounded-lg py-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-[200px] lg:gap-3.5 lg:border lg:pt-6 lg:pb-5',
        isSelected
          ? 'bg-secondary lg:border-2 lg:border-primary'
          : 'bg-background lg:border-border',
      )}
    >
      <span
        className={cn(
          'rounded-full',
          isSelected ? 'ring-3 ring-primary' : 'ring-1 ring-primary-border',
        )}
      >
        <FaceCrop
          imageUrl={candidate.repFace.url}
          faceBox={candidate.repFace.bbox}
          size={isDesktop ? 140 : isNarrowPhone ? 76 : 92}
          onImageError={onImageError}
        />
      </span>
      <span className="text-small font-semibold lg:text-[15px]">사진 {candidate.photoCount}장</span>
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full lg:top-3.5 lg:right-3.5 lg:size-7',
          isSelected ? 'bg-primary text-white' : 'border-2 border-input bg-background',
        )}
      >
        {isSelected && <CheckIcon className="size-3.5 lg:size-4" strokeWidth={3} />}
      </span>
    </button>
  )
}
