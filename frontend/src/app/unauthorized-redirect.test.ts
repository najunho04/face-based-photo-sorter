import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUnauthorizedHandler } from '@/app/unauthorized-redirect'
import {
  clearAllSessions,
  readAdministratorSession,
  readParticipantSession,
  saveAdministratorSession,
  saveParticipantSession,
} from '@/shared/api/token-storage'

afterEach(() => clearAllSessions())

// 지금 주소와 이동 기록만 가진 가짜 라우터
function createFakeRouter(pathname: string, search = '') {
  return { state: { location: { pathname, search } }, navigate: vi.fn() }
}

function saveParticipant(accessCode: string) {
  saveParticipantSession({
    accessToken: 'participant-token',
    eventId: 1,
    eventName: '2026 가을 축제',
    accessCode,
    isEventOpen: true,
  })
}

describe('참가자 401', () => {
  it('입장 정보를 지우고 ⑧로 보내며, 다시 입장할 코드를 넘긴다', () => {
    saveParticipant('A7K2Q9')
    const router = createFakeRouter('/e/A7K2Q9/home')
    const queryClient = new QueryClient()
    const clearSpy = vi.spyOn(queryClient, 'clear')

    createUnauthorizedHandler({ router, queryClient })('participant')

    expect(readParticipantSession()).toBeNull()
    expect(clearSpy).toHaveBeenCalled()
    expect(router.navigate).toHaveBeenCalledWith('/expired?code=A7K2Q9', { replace: true })
  })

  it('입장 정보가 먼저 지워졌어도(동시 요청) 주소에서 코드를 찾는다', () => {
    const router = createFakeRouter('/e/A7K2Q9/photos', '?persons=3,12')

    createUnauthorizedHandler({ router, queryClient: new QueryClient() })('participant')

    expect(router.navigate).toHaveBeenCalledWith('/expired?code=A7K2Q9', { replace: true })
  })

  it('이미 ⑧에 있으면 다시 이동하지 않는다', () => {
    const router = createFakeRouter('/expired', '?code=A7K2Q9')

    createUnauthorizedHandler({ router, queryClient: new QueryClient() })('participant')

    expect(router.navigate).not.toHaveBeenCalled()
  })
})

describe('관리자 401', () => {
  it('로그인 정보를 지우고 로그인 화면으로 보내며, 로그인 뒤 돌아올 주소를 붙인다', () => {
    saveAdministratorSession({ accessToken: 'token', expiresInSeconds: 3600, loginId: 'admin' })
    const router = createFakeRouter('/admin/events/5/processing')

    createUnauthorizedHandler({ router, queryClient: new QueryClient() })('administrator')

    expect(readAdministratorSession()).toBeNull()
    expect(router.navigate).toHaveBeenCalledWith(
      '/admin/login?next=%2Fadmin%2Fevents%2F5%2Fprocessing',
      { replace: true },
    )
  })

  it('이미 로그인 화면에 있으면 다시 이동하지 않는다', () => {
    const router = createFakeRouter('/admin/login')

    createUnauthorizedHandler({ router, queryClient: new QueryClient() })('administrator')

    expect(router.navigate).not.toHaveBeenCalled()
  })
})
