import * as React from 'react'
import { Slot } from 'radix-ui'
import { cn } from '@/shared/lib/utils'
import { badgeVariants, type BadgeVariantProps } from '@/shared/ui/badge-variants'

function Badge({
  className,
  tone = 'info',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & BadgeVariantProps & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp
      data-slot="badge"
      data-tone={tone}
      className={cn(badgeVariants({ tone }), className)}
      {...props}
    />
  )
}

export { Badge }
