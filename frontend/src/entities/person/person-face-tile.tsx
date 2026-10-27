import { Link } from 'react-router'
import { formatPersonName } from '@/entities/person/person-name'
import type { Person } from '@/entities/person/person-types'
import { desktopMediaQuery, useMediaQuery } from '@/shared/lib/use-media-query'
import { FaceCrop } from '@/shared/ui/face-crop'

type PersonFaceTileProps = {
  person: Person
  /** 눌렀을 때 갈 주소 */
  to: string
  /** 대표 얼굴 사진이 깨졌을 때(주소 만료) 목록을 다시 받도록 알린다 */
  onImageError?: () => void
}

// 사람 폴더 한 칸: 대표 얼굴 동그라미 + "사진 N장" (시안 ② 휴대폰 88px, P2 PC 96px 카드).
// 화면에는 장 수만 보이고, 화면 낭독기에는 "사람 3, 사진 12장"으로 읽힌다
export function PersonFaceTile({ person, to, onImageError }: PersonFaceTileProps) {
  const isDesktop = useMediaQuery(desktopMediaQuery)
  return (
    <Link
      to={to}
      aria-label={`${formatPersonName(person.label)}, 사진 ${person.photoCount}장`}
      className="flex flex-col items-center gap-1.5 rounded-lg py-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring lg:gap-2 lg:border lg:border-border lg:px-2 lg:py-4 lg:hover:bg-muted"
    >
      <FaceCrop
        imageUrl={person.repFace?.url ?? null}
        faceBox={person.repFace?.bbox ?? null}
        size={isDesktop ? 96 : 88}
        onImageError={onImageError}
      />
      <span aria-hidden="true" className="text-[13px] leading-5 font-semibold lg:text-small">
        사진 {person.photoCount}장
      </span>
    </Link>
  )
}
