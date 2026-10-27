import { CircleAlertIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

type ErrorStateProps = {
  /** 무슨 일이 생겼는지 한 문장 */
  title: string
  /** 무엇을 하면 되는지 한 문장 */
  description?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

// 불러오기 실패 등 오류 화면. 명세서 10장 문구 규칙: 무슨 일 + 무엇을 하면 되는지
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = '다시 시도',
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-4 px-6 py-12 text-center', className)}
    >
      <div className="flex size-18 items-center justify-center rounded-full bg-danger-soft">
        <CircleAlertIcon className="size-8 text-danger" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-headline text-foreground">{title}</p>
        {description && <p className="text-small text-muted-foreground">{description}</p>}
      </div>
      {onRetry && <Button onClick={onRetry}>{retryLabel}</Button>}
    </div>
  )
}
