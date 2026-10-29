import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeftIcon, SearchXIcon, UserRoundXIcon, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { saveMyPersonIds } from '@/entities/person/my-person-storage'
import { personPhotosQueryOptions } from '@/entities/person/person-queries'
import type { Person } from '@/entities/person/person-types'
import { useCurrentParticipantSession } from '@/entities/session/participant-session'
import { CandidateCard } from '@/features/selfie-search/candidate-card'
import { readSelfieMatchResult } from '@/features/selfie-search/selfie-match-result-storage'
import { paths } from '@/shared/config/paths'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

// ④ 후보 선택 · ④-1 후보 없음 · ④-2 얼굴 못 찾음 (휴대폰 시안 ④·④-1·④-2, PC P4).
// ③에서 저장한 검색 결과를 읽어 보여 준다. 결과가 없으면(주소로 바로 들어옴) 촬영 화면으로 보낸다
export default function CandidatesPage() {
  const session = useCurrentParticipantSession()
  const [matchResult] = useState(() => readSelfieMatchResult(session.eventId))

  if (!matchResult) return <Navigate to={paths.eventCamera(session.accessCode)} replace />
  if (matchResult.kind === 'no-match') {
    return (
      <SearchFailureView
        accessCode={session.accessCode}
        icon={SearchXIcon}
        title="닮은 사람을 찾지 못했어요"
        description="밝은 곳에서 정면으로, 한 명만 나오게 다시 찍어보세요. 사람별 사진에서 직접 찾을 수도 있어요."
      />
    )
  }
  if (matchResult.kind === 'no-face') {
    return (
      <SearchFailureView
        accessCode={session.accessCode}
        icon={UserRoundXIcon}
        title="셀카에서 얼굴이 보이지 않아요"
        description="얼굴이 화면 가운데에 크게 나오도록, 밝은 곳에서 다시 찍어주세요. 모자나 선글라스는 벗어주세요."
      />
    )
  }
  return (
    <CandidateSelection
      eventId={session.eventId}
      accessCode={session.accessCode}
      candidates={matchResult.candidates}
    />
  )
}

// ④ 후보 고르기: 처음에는 아무도 고르지 않은 상태(결정 기록 5단계). 고른 사람을 '내 폴더'로 기억하고 ⑤로 간다
function CandidateSelection({
  eventId,
  accessCode,
  candidates,
}: {
  eventId: number
  accessCode: string
  candidates: Person[]
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>([])
  const [showSelectionHint, setShowSelectionHint] = useState(false)

  // 고르거나 뺀다. 고른 사람의 사진(#9)은 미리 받아 두어 ⑤가 바로 열리게 한다
  function toggleCandidate(personId: number) {
    setShowSelectionHint(false)
    setSelectedPersonIds((current) => {
      if (current.includes(personId)) return current.filter((id) => id !== personId)
      void queryClient.prefetchQuery(
        personPhotosQueryOptions({ eventId, personId, requester: 'participant' }),
      )
      return [...current, personId]
    })
  }

  function confirmSelection() {
    if (selectedPersonIds.length === 0) {
      setShowSelectionHint(true)
      return
    }
    // 후보 화면에 보인 순서(비슷한 순)대로 넘긴다. 셀카로 새로 찾은 결과로 '내 폴더'를 바꾼다
    const orderedPersonIds = candidates
      .map((candidate) => candidate.personId)
      .filter((personId) => selectedPersonIds.includes(personId))
    saveMyPersonIds(eventId, orderedPersonIds)
    void navigate(paths.eventPhotos(accessCode, orderedPersonIds))
  }

  const selectedCount = selectedPersonIds.length
  const confirmLabel =
    selectedCount === 0
      ? '본인 얼굴을 골라주세요'
      : selectedCount === 1
        ? '이게 나예요'
        : `이게 나예요 · ${selectedCount}명 선택`

  return (
    <div className="flex flex-1 flex-col px-6 pt-[calc(env(safe-area-inset-top)+8px)] pb-[calc(env(safe-area-inset-bottom)+32px)] lg:mx-auto lg:w-full lg:max-w-[760px] lg:items-center lg:py-16 lg:text-center">
      <BackToCameraButton accessCode={accessCode} />
      <div className="mt-6 flex flex-col gap-2 lg:mt-0 lg:gap-3">
        <h1 className="text-title-1 lg:text-[32px] lg:leading-10">이 중에 본인이 있나요?</h1>
        <p className="text-[15px] leading-6 text-muted-foreground lg:text-body">
          같은 사람이 두 번 나올 수 있어요.
          <br className="lg:hidden" /> 본인이면 모두 골라주세요.
        </p>
      </div>
      {/* 휴대폰: 세 칸을 한 줄에(칸 폭은 화면에 맞춰 최대 106px) / PC: 200px 카드 */}
      <ul className="mt-12 flex justify-center gap-3 lg:flex-wrap lg:gap-5">
        {candidates.map((candidate, index) => (
          <li
            key={candidate.personId}
            className="w-[calc((100%-1.5rem)/3)] max-w-[106px] lg:w-auto lg:max-w-none"
          >
            <CandidateCard
              candidate={candidate}
              order={index + 1}
              isSelected={selectedPersonIds.includes(candidate.personId)}
              onToggle={() => toggleCandidate(candidate.personId)}
            />
          </li>
        ))}
      </ul>
      <div className="min-h-8 flex-1 lg:hidden" />
      {showSelectionHint && (
        <p role="alert" className="mb-2 text-center text-small text-danger lg:mt-6 lg:mb-0">
          본인 얼굴을 하나 이상 골라주세요.
        </p>
      )}
      {/* PC(P4): 카드와 버튼 사이 48px, 나란한 두 버튼은 같은 52px 높이 */}
      <div className="flex flex-col gap-3 lg:mt-12 lg:flex-row-reverse lg:justify-center">
        <Button
          size="lg"
          onClick={confirmSelection}
          aria-disabled={selectedCount === 0}
          // 아무도 고르지 않았을 때는 회색으로 보여 주되, 누르면 이유를 알려 준다(명세서 8.2).
          // 누르는 순간에도 남색으로 바뀌지 않게 active 색까지 회색으로 덮는다
          className={cn(
            'lg:h-13 lg:px-9 lg:text-[15px]',
            selectedCount === 0 &&
              'bg-border text-muted-foreground hover:bg-border active:bg-border',
          )}
        >
          {confirmLabel}
        </Button>
        <Button asChild variant="secondary" className="h-12 lg:h-13 lg:px-7">
          <Link to={paths.eventCamera(accessCode)}>이 중에 없어요 · 다시 찍기</Link>
        </Button>
      </div>
      <Link
        to={paths.eventHome(accessCode)}
        className="mt-2 flex min-h-11 items-center justify-center text-small font-semibold text-primary"
      >
        사람별 사진에서 직접 찾기
      </Link>
    </div>
  )
}

// ④-1·④-2: 찾지 못한 이유와 다시 찍기 / 사람별 사진에서 찾기
function SearchFailureView({
  accessCode,
  icon: Icon,
  title,
  description,
}: {
  accessCode: string
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="flex flex-1 flex-col px-6 pt-[calc(env(safe-area-inset-top)+8px)] pb-[calc(env(safe-area-inset-bottom)+32px)] lg:mx-auto lg:w-full lg:max-w-[480px] lg:py-16">
      <BackToCameraButton accessCode={accessCode} />
      <div className="flex flex-1 flex-col justify-center gap-6 py-10">
        <div className="flex size-18 items-center justify-center rounded-full bg-muted">
          <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-title-1">{title}</h1>
          <p className="text-[15px] leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button asChild size="lg">
        <Link to={paths.eventCamera(accessCode)}>다시 찍기</Link>
      </Button>
      <Button asChild variant="secondary" className="mt-3 h-12">
        <Link to={paths.eventHome(accessCode)}>사람별 사진에서 찾기</Link>
      </Button>
    </div>
  )
}

// 왼쪽 위 뒤로 가기(촬영 화면으로). PC에서는 가운데 정렬 화면이라 숨긴다
function BackToCameraButton({ accessCode }: { accessCode: string }) {
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      aria-label="다시 찍기"
      className="-ml-2.5 lg:hidden"
    >
      <Link to={paths.eventCamera(accessCode)}>
        <ChevronLeftIcon className="size-6" />
      </Link>
    </Button>
  )
}
