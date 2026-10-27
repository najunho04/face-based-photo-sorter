import { cva, type VariantProps } from 'class-variance-authority'

// 디자인 명세서 8.2 버튼 변형
// - default: 주 버튼(화면당 하나), secondary: 연한 인디고, ghost, destructive, link
// - 크기: lg 56(참가자 주요 버튼), default 44(관리자·PC), sm 36(표·목록 안), icon 44
// - sm은 보이는 높이는 36~40px이지만, 위아래로 보이지 않는 여백(::after)을 붙여 눌리는 영역을 44px 이상으로 한다
// - 비활성은 흐리게(opacity) 하지 않고 회색 배경 + 진한 회색 글자로 대비를 지킨다
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-[background-color,color,transform] duration-150 ease-out outline-none select-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-pressed disabled:bg-border disabled:text-muted-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-primary-soft-hover disabled:bg-border disabled:text-muted-foreground',
        ghost:
          'text-muted-foreground hover:bg-muted hover:text-foreground disabled:text-text-muted',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-danger disabled:bg-border disabled:text-muted-foreground',
        link: 'text-primary underline-offset-4 hover:underline disabled:text-text-muted',
      },
      size: {
        lg: 'h-14 px-6 text-body',
        default: 'h-11 px-5 text-[15px]',
        sm: "relative h-9 rounded-sm px-3.5 text-small after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] [&_svg:not([class*='size-'])]:size-4",
        icon: 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>
