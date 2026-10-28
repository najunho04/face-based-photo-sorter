import { Outlet } from 'react-router'
import { AdministratorSideMenu } from '@/pages/admin/administrator-navigation'

// 관리자 화면 틀 (명세서 7장): 회색 바탕, PC(1024px 이상)는 왼쪽 메뉴 232px + 본문.
// 그보다 좁으면 왼쪽 메뉴를 숨기고, 각 화면이 위쪽 머리글(AdministratorMobileHeader)을 그린다.
// PC 여백(위아래 40px·좌우 48px)은 시안 A2~A7처럼 머리글과 본문을 함께 감싸는 여기서 준다.
// 제목 줄과 내용 사이는 기본 20px(A4~A7), 더 넓은 화면은 머리글의 spacingBelow로 늘린다(A2 28px, A3 24px)
export function AdministratorLayout() {
  return (
    <div className="min-h-dvh bg-muted lg:flex">
      <AdministratorSideMenu className="hidden lg:flex" />
      <main className="min-w-0 flex-1 lg:flex lg:flex-col lg:gap-5 lg:px-12 lg:py-10">
        <Outlet />
      </main>
    </div>
  )
}
