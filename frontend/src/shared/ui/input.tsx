import * as React from 'react'
import { cn } from '@/shared/lib/utils'

type InputProps = React.ComponentProps<'input'> & {
  /** default 44px(관리자·PC), lg 56px(참가자 화면) */
  inputSize?: 'default' | 'lg'
}

// 글자는 항상 16px 이상: 아이폰 Safari는 16px 미만 입력칸을 누르면 화면을 확대한다
function Input({ className, type, inputSize = 'default', ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'w-full min-w-0 rounded-md border-[1.5px] border-input bg-background text-body text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-text-muted selection:bg-primary selection:text-primary-foreground',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-small file:font-medium file:text-foreground',
        'disabled:cursor-not-allowed disabled:bg-muted',
        'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30',
        'aria-invalid:border-danger aria-invalid:ring-danger/20',
        inputSize === 'lg' ? 'h-14 px-4' : 'h-11 px-3.5',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
