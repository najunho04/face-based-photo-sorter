import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description?: string
  /** 다음 행동 버튼 하나 (명세서 10장: 빈 화면은 행동 하나로 안내) */
  action?: ReactNode
  className?: string
}

// 보여줄 내용이 없을 때의 화면: 아이콘 + 제목 한 줄 + 설명 한 줄 + 행동 버튼 하나
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-4 px-6 py-12 text-center', className)}>
      <div className="flex size-18 items-center justify-center rounded-full bg-muted">
        <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-headline text-foreground">{title}</p>
        {description && <p className="text-small text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
