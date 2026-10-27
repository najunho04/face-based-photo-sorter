import { cva, type VariantProps } from 'class-variance-authority'

// 디자인 명세서 2.3 상태 색. 색만으로 의미를 전달하지 않도록 배지에는 항상 글자를 쓴다.
export const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full px-2.5 py-1 text-caption font-semibold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5',
  {
    variants: {
      tone: {
        info: 'bg-secondary text-secondary-foreground',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        neutral: 'bg-neutral-soft text-muted-foreground',
      },
    },
    defaultVariants: {
      tone: 'info',
    },
  },
)

export type BadgeVariantProps = VariantProps<typeof badgeVariants>
