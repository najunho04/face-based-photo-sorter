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
      className={cn(buttonVariants({ variant, size }), className)}
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
