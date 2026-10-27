import { cn } from '@/shared/lib/utils'

// 로고 글자 크기: 휴대폰 헤더 18px, PC 헤더 20px, 작은 곳 16px (명세서 8.3 AppLogo)
const logoSizeClassNames = {
  small: 'text-base',
  medium: 'text-lg',
  large: 'text-xl',
} as const

type AppLogoProps = {
  size?: keyof typeof logoSizeClassNames
  /** 관리자 화면에서 로고 옆에 '관리자' 칩을 붙인다 */
  showAdministratorBadge?: boolean
  className?: string
}

// 글자 로고 "인생내컷". 별도 로고 이미지를 만들기 전까지 쓰는 임시 로고(명세서 1장 결정)
export function AppLogo({
  size = 'medium',
  showAdministratorBadge = false,
  className,
}: AppLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className={cn('font-bold text-primary', logoSizeClassNames[size])}>인생내컷</span>
      {showAdministratorBadge && (
        <span className="rounded-full bg-secondary px-2 py-0.5 text-caption text-secondary-foreground">
          관리자
        </span>
      )}
    </span>
  )
}
