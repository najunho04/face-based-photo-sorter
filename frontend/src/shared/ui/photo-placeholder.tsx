import { ImageIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

type PhotoPlaceholderProps = {
  /** 가로세로 비율. 사진 격자는 휴대폰 1:1, PC 4:3 (명세서 8.3 PhotoGrid) */
  aspectRatio?: 'square' | 'landscape'
  showIcon?: boolean
  className?: string
}

// 사진이 아직 안 왔거나 불러오지 못했을 때 자리를 미리 잡아 화면이 들썩이지 않게 한다
export function PhotoPlaceholder({
  aspectRatio = 'square',
  showIcon = false,
  className,
}: PhotoPlaceholderProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex w-full items-center justify-center bg-placeholder',
        aspectRatio === 'square' ? 'aspect-square' : 'aspect-[4/3]',
        className,
      )}
    >
      {showIcon && <ImageIcon className="size-8 text-text-muted" />}
    </div>
  )
}
