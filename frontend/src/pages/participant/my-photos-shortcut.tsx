import { useQueries } from '@tanstack/react-query'
import { CameraIcon, ChevronRightIcon } from 'lucide-react'
import { Link } from 'react-router'
import { mergePersonPhotos } from '@/entities/person/merge-person-photos'
import { personPhotosQueryOptions } from '@/entities/person/person-queries'
import type { Person } from '@/entities/person/person-types'
import { isApiErrorWithCode } from '@/shared/api/api-error'
import { paths } from '@/shared/config/paths'
import { cn } from '@/shared/lib/utils'
import { FaceCrop } from '@/shared/ui/face-crop'

type MyPhotosShortcutProps = {
  eventId: number
  accessCode: string
  /** 기억해 둔 내 폴더(사람 번호) */
  myPersonIds: number[]
  /** ②에서 받은 사람 목록. 내 폴더의 대표 얼굴을 여기서 찾는다(사진 1장뿐인 폴더는 없을 수 있음) */
  persons: Person[] | undefined
  onImageError: () => void
}

// ②-2 내 사진 바로가기: 기억해 둔 내 폴더의 얼굴과 '내 사진 N장'(중복 뺀 정확한 장 수)을 보여 주고 ⑤로 보낸다.
// 결정: 내 폴더들의 사진(#9)을 미리 받아 센다. 같은 데이터를 ⑤가 그대로 쓰므로 ⑤가 바로 열린다
export function MyPhotosShortcut({
  eventId,
  accessCode,
  myPersonIds,
  persons,
  onImageError,
}: MyPhotosShortcutProps) {
  const photoQueries = useQueries({
    queries: myPersonIds.map((personId) =>
      personPhotosQueryOptions({ eventId, personId, requester: 'participant' }),
    ),
  })

  // 행사를 다시 정리해 폴더가 없어졌으면(PERSON_NOT_FOUND) 그 폴더는 빼고 보여 준다
  const validPersonIds = myPersonIds.filter(
    (_, index) => !isApiErrorWithCode(photoQueries[index]?.error, 'PERSON_NOT_FOUND'),
  )
  if (validPersonIds.length === 0) return null

  const isCounting = photoQueries.some((photoQuery) => photoQuery.isPending)
  const photoCount = mergePersonPhotos(
    photoQueries.flatMap((photoQuery) => (photoQuery.data ? [photoQuery.data.photos] : [])),
  ).length

  return (
    <div className="flex flex-col gap-2.5">
      <Link
        to={paths.eventPhotos(accessCode, validPersonIds)}
        className="flex items-center gap-3 rounded-lg bg-secondary p-4 transition-colors outline-none hover:bg-primary-soft-hover focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex shrink-0" aria-hidden="true">
          {validPersonIds.slice(0, 3).map((personId, index) => {
            const person = persons?.find((candidate) => candidate.personId === personId)
            const overlapClassName = cn(
              'rounded-full ring-2 ring-secondary',
              index > 0 && '-ml-3.5',
            )
            return person ? (
              <FaceCrop
                key={personId}
                imageUrl={person.repFace?.url ?? null}
                faceBox={person.repFace?.bbox ?? null}
                size={48}
                onImageError={onImageError}
                className={overlapClassName}
              />
            ) : (
              <span key={personId} className={cn('size-12 bg-placeholder', overlapClassName)} />
            )
          })}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[17px] leading-6 font-bold">
            {isCounting ? '내 사진' : `내 사진 ${photoCount}장`}
          </span>
          <span className="text-[13px] leading-5 text-secondary-foreground">
            아까 찾은 사진이에요
          </span>
        </div>
        <ChevronRightIcon
          className="size-5 shrink-0 text-secondary-foreground"
          aria-hidden="true"
        />
      </Link>
      <Link
        to={paths.eventCamera(accessCode)}
        className="flex h-11 items-center justify-center gap-1.5 text-small font-semibold text-primary"
      >
        <CameraIcon className="size-4.5" aria-hidden="true" />
        셀카로 다시 찾기
      </Link>
    </div>
  )
}
