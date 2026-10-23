import { useEffect } from 'react'
import { Outlet, ScrollRestoration, useMatches } from 'react-router'

/** 라우트마다 붙이는 부가 정보. title은 브라우저 탭 제목이 된다 */
export type RouteHandle = { title?: string }

// 모든 화면을 감싸는 맨 바깥 틀: 탭 제목을 바꾸고, 뒤로 가기 때 스크롤 위치를 되살린다(사진 격자로 돌아올 때)
export function RootLayout() {
  useDocumentTitle()
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  )
}

// 지금 화면에서 가장 안쪽 라우트의 title로 탭 제목을 정한다. 예: "사람별 사진 · 인생내컷"
function useDocumentTitle() {
  const matches = useMatches()
  const title = [...matches]
    .reverse()
    .map((match) => (match.handle as RouteHandle | undefined)?.title)
    .find((routeTitle) => routeTitle !== undefined)

  useEffect(() => {
    document.title = title ? `${title} · 인생내컷` : '인생내컷'
  }, [title])
}
