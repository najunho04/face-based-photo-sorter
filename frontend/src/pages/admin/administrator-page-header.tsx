import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { AdministratorMobileHeader } from '@/pages/admin/administrator-navigation'
import { cn } from '@/shared/lib/utils'

type Breadcrumb = { label: string; to?: string }

/** PC 제목 줄과 아래 내용 사이 간격(px). 레이아웃 기본 20px(A4~A7)에 더한다 */
type SpacingBelow = 20 | 24 | 28

const extraMarginBySpacingBelow: Record<SpacingBelow, string> = {
  20: '',
  24: 'lg:mb-1',
  28: 'lg:mb-2',
}

type AdministratorPageHeaderProps = {
  title: string
  /** PC 제목 위 경로(시안: 최근 행사 / 2026 가을 축제) */
  breadcrumbs?: Breadcrumb[]
  /** 휴대폰 머리글 제목 위 작은 행사 이름 */
  eventName?: string
  /** 휴대폰 뒤로 가기 주소. 없으면 로고와 ☰ 메뉴 */
  backTo?: string
  /** 제목 옆 배지(공개 중 등) */
  badge?: ReactNode
  /** 제목 아래 한 줄 설명 */
  description?: ReactNode
  /** PC 제목·설명 왼쪽에 붙는 그림(A7 대표 얼굴). 있으면 경로 줄과 20px 띄운다 */
  leadingVisual?: ReactNode
  /** PC 오른쪽 버튼들 */
  actions?: ReactNode
  /** 휴대폰 머리글 오른쪽 버튼 */
  mobileAction?: ReactNode
  /** PC 제목 줄과 내용 사이 간격. 시안: A2 28px, A3 24px, 나머지 20px */
  spacingBelow?: SpacingBelow
}

// 관리자 화면 머리글: 휴대폰은 위쪽 머리글(M1~M3), PC는 경로 + 큰 제목 + 오른쪽 버튼(A2~A7)
export function AdministratorPageHeader({
  title,
  breadcrumbs,
  eventName,
  backTo,
  badge,
  description,
  leadingVisual,
  actions,
  mobileAction,
  spacingBelow = 20,
}: AdministratorPageHeaderProps) {
  const titleAndDescription = (
    <>
      <div className="flex items-center gap-2.5">
        <h1 className="text-[26px] leading-9 font-bold">{title}</h1>
        {badge}
      </div>
      {description && <p className="text-small text-muted-foreground">{description}</p>}
    </>
  )

  return (
    <>
      <AdministratorMobileHeader
        title={title}
        eventName={eventName}
        backTo={backTo}
        action={mobileAction}
      />
      <div
        className={cn(
          'hidden flex-wrap items-end justify-between gap-4 lg:flex',
          extraMarginBySpacingBelow[spacingBelow],
        )}
      >
        <div className={cn('flex flex-col', leadingVisual ? 'gap-5' : 'gap-1.5')}>
          {breadcrumbs && (
            <nav aria-label="경로" className="text-[13px] text-muted-foreground">
              {breadcrumbs.map((breadcrumb, index) => (
                <span key={`${breadcrumb.label}-${index}`}>
                  {index > 0 && ' / '}
                  {breadcrumb.to ? (
                    <Link
                      to={breadcrumb.to}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      {breadcrumb.label}
                    </Link>
                  ) : (
                    breadcrumb.label
                  )}
                </span>
              ))}
            </nav>
          )}
          {/* A7: 얼굴 오른쪽에 큰 제목과 설명이 위아래로(시안 간격 16px·4px) */}
          {leadingVisual ? (
            <div className="flex items-center gap-4">
              {leadingVisual}
              <div className="flex flex-col gap-1">{titleAndDescription}</div>
            </div>
          ) : (
            titleAndDescription
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </>
  )
}

/** 관리자 화면 본문 틀: 휴대폰 16px 여백·요소 사이 12px(M1~M3). PC 여백은 머리글과 함께 레이아웃(AdministratorLayout)이 준다 */
export function AdministratorPageBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 px-4 py-4 lg:gap-5 lg:p-0">{children}</div>
}
