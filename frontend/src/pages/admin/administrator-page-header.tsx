import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { AdministratorMobileHeader } from '@/pages/admin/administrator-navigation'

type Breadcrumb = { label: string; to?: string }

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
  /** PC 오른쪽 버튼들 */
  actions?: ReactNode
  /** 휴대폰 머리글 오른쪽 버튼 */
  mobileAction?: ReactNode
}

// 관리자 화면 머리글: 휴대폰은 위쪽 머리글(M1~M3), PC는 경로 + 큰 제목 + 오른쪽 버튼(A2~A7)
export function AdministratorPageHeader({
  title,
  breadcrumbs,
  eventName,
  backTo,
  badge,
  description,
  actions,
  mobileAction,
}: AdministratorPageHeaderProps) {
  return (
    <>
      <AdministratorMobileHeader
        title={title}
        eventName={eventName}
        backTo={backTo}
        action={mobileAction}
      />
      <div className="hidden flex-wrap items-end justify-between gap-4 lg:flex">
        <div className="flex flex-col gap-1.5">
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
          <div className="flex items-center gap-2.5">
            <h1 className="text-[26px] leading-9 font-bold">{title}</h1>
            {badge}
          </div>
          {description && <p className="text-small text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </>
  )
}

/** 관리자 화면 본문 틀: 휴대폰 16px, PC 40·48px 여백 */
export function AdministratorPageBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-5 px-4 py-4 lg:px-12 lg:py-10">{children}</div>
}
