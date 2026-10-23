import type { QueryClient } from '@tanstack/react-query'
import { matchPath } from 'react-router'
import { toast } from 'sonner'
import { paths } from '@/shared/config/paths'
import { setUnauthorizedListener, type Requester } from '@/shared/api/client'
import {
  clearAdministratorSession,
  clearParticipantSession,
  readParticipantSession,
} from '@/shared/api/token-storage'

/** 401 처리에 필요한 라우터 기능만 추린 모양(테스트에서 가짜 라우터를 넘기려고) */
type NavigableRouter = {
  state: { location: { pathname: string; search: string } }
  navigate: (to: string, options: { replace: boolean }) => unknown
}

type UnauthorizedHandlerDependencies = { router: NavigableRouter; queryClient: QueryClient }

// API가 UNAUTHORIZED(401)를 돌려줬을 때 할 일. 참가자는 ⑧ 입장 시간 만료로, 관리자는 A1 로그인으로 보낸다.
// 여러 요청이 동시에 401을 받아도 한 번만 이동하도록 이미 그 화면이면 아무것도 하지 않는다.
export function createUnauthorizedHandler({
  router,
  queryClient,
}: UnauthorizedHandlerDependencies) {
  return (requester: Exclude<Requester, 'anonymous'>) => {
    const { pathname, search } = router.state.location

    if (requester === 'participant') {
      if (pathname === '/expired') return
      // 결정: [다시 입장하기]가 바로 재입장하도록 코드를 넘긴다. 세션이 먼저 지워졌으면 주소에서 찾는다
      const accessCode =
        readParticipantSession()?.accessCode ?? matchPath('/e/:code/*', pathname)?.params.code
      clearParticipantSession()
      queryClient.clear()
      router.navigate(paths.sessionExpired(accessCode), { replace: true })
      return
    }

    if (pathname === '/admin/login') return
    clearAdministratorSession()
    queryClient.clear()
    toast('로그인 시간이 끝났어요. 다시 로그인해주세요.', { id: 'administrator-session-expired' })
    router.navigate(paths.administratorLogin(`${pathname}${search}`), { replace: true })
  }
}

// 앱이 시작할 때 API 클라이언트에 401 처리를 연결한다. 돌려받은 함수를 부르면 연결을 끊는다
export function connectUnauthorizedRedirect(dependencies: UnauthorizedHandlerDependencies) {
  return setUnauthorizedListener(createUnauthorizedHandler(dependencies))
}
