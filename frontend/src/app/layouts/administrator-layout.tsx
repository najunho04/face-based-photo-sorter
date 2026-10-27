import { Outlet } from 'react-router'
import { AdministratorSideMenu } from '@/pages/admin/administrator-navigation'

// 관리자 화면 틀 (명세서 7장): 회색 바탕, PC(1024px 이상)는 왼쪽 메뉴 232px + 본문.
// 그보다 좁으면 왼쪽 메뉴를 숨기고, 각 화면이 위쪽 머리글(AdministratorMobileHeader)을 그린다
export function AdministratorLayout() {
  return (
    <div className="min-h-dvh bg-muted lg:flex">
      <AdministratorSideMenu className="hidden lg:flex" />
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
