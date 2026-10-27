import * as React from 'react'
import { LoaderCircleIcon } from 'lucide-react'
import { Slot } from 'radix-ui'
import { cn } from '@/shared/lib/utils'
import { buttonVariants, type ButtonVariantProps } from '@/shared/ui/button-variants'

type ButtonProps = React.ComponentProps<'button'> &
  ButtonVariantProps & {
    asChild?: boolean
    /** 로딩 중: 회전 아이콘을 보여주고 중복 클릭을 막는다(글자는 그대로 둔다) */
    loading?: boolean
  }

// 로딩 중에도 클릭은 막지만(disabled) 비활성 회색 대신 원래 색을 유지한다 (명세서 8.2: 로딩은 글자 유지)
const loadingColorClassNames = {
  default: 'disabled:bg-primary disabled:text-primary-foreground',
  secondary: 'disabled:bg-secondary disabled:text-secondary-foreground',
  ghost: 'disabled:text-muted-foreground',
  destructive: 'disabled:bg-destructive disabled:text-destructive-foreground',
  link: 'disabled:text-primary',
} as const

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        buttonVariants({ variant, size }),
        loading && variant && loadingColorClassNames[variant],
        className,
      )}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <LoaderCircleIcon className="animate-spin" aria-hidden="true" />}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button }
