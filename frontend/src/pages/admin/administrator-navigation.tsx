import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeftIcon, LogOutIcon, MenuIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { paths } from '@/shared/config/paths'
import { clearAdministratorSession, readAdministratorSession } from '@/shared/api/token-storage'
import { cn } from '@/shared/lib/utils'
import { AppLogo } from '@/shared/ui/app-logo'
import { Button } from '@/shared/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/shared/ui/drawer'

// 관리자 화면 공통 길잡이: PC 왼쪽 메뉴(시안 A2~A7)와 휴대폰 위쪽 머리글(시안 M1~M3).
// 왼쪽 메뉴는 관리자 레이아웃(app)이, 휴대폰 머리글은 각 관리자 화면이 쓴다.

// 메뉴 항목. '최근 행사'는 행사 안의 화면(업로드·정리·결과)에서도 선택된 것으로 보여 준다(시안 A5)
const menuItems = [
  {
    label: '최근 행사',
    to: paths.administratorEvents,
    isActive: (pathname: string) =>
      pathname.startsWith(paths.administratorEvents) &&
      !pathname.startsWith(paths.administratorEventCreate),
  },
  {
    label: '새 행사 만들기',
    to: paths.administratorEventCreate,
    isActive: (pathname: string) => pathname.startsWith(paths.administratorEventCreate),
  },
]

// 로그아웃: 토큰과 받아 둔 데이터를 지우고 로그인 화면으로 간다
function useLogout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return () => {
    clearAdministratorSession()
    queryClient.clear()
    toast('로그아웃했어요')
    void navigate(paths.administratorLogin(), { replace: true })
  }
}

/** PC(1024px 이상) 왼쪽 메뉴 232px */
export function AdministratorSideMenu({ className }: { className?: string }) {
  const { pathname } = useLocation()
  const logout = useLogout()
  const loginId = readAdministratorSession()?.loginId

  return (
    <nav
      aria-label="관리자 메뉴"
      className={cn(
        'sticky top-0 h-dvh w-[232px] shrink-0 flex-col gap-1 border-r border-border bg-background px-4 py-7',
        className,
      )}
    >
      <Link
        to={paths.administratorEvents}
        className="mb-5 rounded-sm px-2 py-1"
        aria-label="최근 행사로"
      >
        <AppLogo size="medium" showAdministratorBadge />
      </Link>
      {menuItems.map((menuItem) => {
        const isActive = menuItem.isActive(pathname)
        return (
          <Link
            key={menuItem.to}
            to={menuItem.to}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center rounded-sm px-3 text-small transition-colors',
              isActive
                ? 'bg-secondary font-semibold text-primary-hover'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {menuItem.label}
          </Link>
        )
      })}
      <div className="flex-1" />
      <div className="flex flex-col items-start gap-1 border-t border-border px-3 pt-3">
        {loginId && <span className="text-small font-semibold">{loginId}</span>}
        <button
          type="button"
          onClick={logout}
          className="min-h-9 text-small text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          로그아웃
        </button>
      </div>
    </nav>
  )
}

type AdministratorMobileHeaderProps = {
  /** 화면 제목 */
  title: string
  /** 행사 안의 화면이면 제목 위에 작게 보여 줄 행사 이름 */
  eventName?: string
  /** 있으면 왼쪽에 뒤로 가기 버튼(행사 안의 화면), 없으면 로고와 ☰ 메뉴(첫 화면) */
  backTo?: string
  /** 오른쪽 끝에 둘 버튼(시안 M3의 'QR 보기' 등) */
  action?: ReactNode
}

/** 휴대폰·태블릿(1024px 미만) 위쪽 머리글. PC에서는 숨긴다 */
export function AdministratorMobileHeader({
  title,
  eventName,
  backTo,
  action,
}: AdministratorMobileHeaderProps) {
  return (
    <header className="flex items-center gap-1 border-b border-border bg-background px-3 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 lg:hidden">
      {backTo ? (
        <>
          <Button asChild variant="ghost" size="icon" aria-label="뒤로">
            <Link to={backTo}>
              <ChevronLeftIcon className="size-6" />
            </Link>
          </Button>
          <div className="flex min-w-0 flex-col">
            {eventName && (
              <span className="truncate text-caption text-muted-foreground">{eventName}</span>
            )}
            <h1 className="truncate text-[18px] leading-6 font-bold">{title}</h1>
          </div>
          {action && <div className="ml-auto shrink-0 pr-1">{action}</div>}
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-1 px-2">
            <AppLogo size="small" showAdministratorBadge />
            <h1 className="text-title-1">{title}</h1>
          </div>
          <AdministratorMenuSheet />
        </>
      )}
    </header>
  )
}

// ☰ 메뉴: 아래에서 올라오는 시트(결정: 참가자 저장 시트와 같은 모양, 엄지로 누르기 쉬움)
function AdministratorMenuSheet() {
  const { pathname } = useLocation()
  const logout = useLogout()
  const loginId = readAdministratorSession()?.loginId

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="메뉴">
          <MenuIcon className="size-6" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>관리자 메뉴</DrawerTitle>
          <DrawerDescription>
            {loginId ? `${loginId} 계정으로 로그인했어요` : '관리자 화면'}
          </DrawerDescription>
        </DrawerHeader>
        <nav aria-label="관리자 메뉴" className="flex flex-col gap-1 px-4 pb-6">
          {menuItems.map((menuItem) => {
            const isActive = menuItem.isActive(pathname)
            return (
              <DrawerClose asChild key={menuItem.to}>
                <Link
                  to={menuItem.to}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex min-h-12 items-center rounded-md px-4 text-body',
                    isActive ? 'bg-secondary font-semibold text-primary-hover' : 'hover:bg-muted',
                  )}
                >
                  {menuItem.label}
                </Link>
              </DrawerClose>
            )
          })}
          <DrawerClose asChild>
            <button
              type="button"
              onClick={logout}
              className="flex min-h-12 items-center gap-2 rounded-md px-4 text-body text-muted-foreground hover:bg-muted"
            >
              <LogOutIcon className="size-5" aria-hidden="true" />
              로그아웃
            </button>
          </DrawerClose>
        </nav>
      </DrawerContent>
    </Drawer>
  )
}
