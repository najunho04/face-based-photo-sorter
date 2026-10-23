import type { EventStatus } from '@/entities/event/event-status'
import { cn } from '@/shared/lib/utils'

// 관리자 화면 위쪽의 단계 표시(시안 A4·A5): 1 사진 올리기 → 2 얼굴 찾기 → 3 사람별로 묶기 → 4 공개
const progressSteps: Array<{ status: EventStatus; label: string }> = [
  { status: 'uploading', label: '사진 올리기' },
  { status: 'extracting', label: '얼굴 찾기' },
  { status: 'clustering', label: '사람별로 묶기' },
  { status: 'open', label: '공개' },
]

export function EventProgressSteps({ status }: { status: EventStatus }) {
  const currentIndex = progressSteps.findIndex((step) => step.status === status)
  return (
    <ol className="flex flex-wrap gap-2" aria-label="진행 단계">
      {progressSteps.map((step, index) => {
        const isDone = index < currentIndex || status === 'open'
        const isCurrent = index === currentIndex && status !== 'open'
        return (
          <li
            key={step.status}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'rounded-full px-3.5 py-2 text-[13px] leading-4',
              isCurrent
                ? 'bg-primary font-semibold text-white'
                : 'border border-border bg-background',
              isDone && 'font-semibold text-success',
              !isCurrent && !isDone && 'text-muted-foreground',
            )}
          >
            {index + 1} {step.label}
            {isDone && index === 0 && ' 완료'}
          </li>
        )
      })}
    </ol>
  )
}
