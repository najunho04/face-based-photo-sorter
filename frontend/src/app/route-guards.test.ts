import { afterEach, describe, expect, it } from 'vitest'
import {
  redirectSignedInAdministrator,
  requireAdministratorSession,
  requireOpenEvent,
  requireParticipantSession,
} from '@/app/route-guards'
import {
  clearAllSessions,
  saveAdministratorSession,
  saveParticipantSession,
} from '@/shared/api/token-storage'

afterEach(() => clearAllSessions())

// 가드에 넘길 loader 인자를 만든다(주소와 주소 안의 값)
function loaderArguments(url: string, params: Record<string, string> = {}) {
  return { request: new Request(`http://localhost:5173${url}`), params } as never
}

// 가드가 던진 redirect 응답에서 이동할 주소를 꺼낸다. 던지지 않았으면 null
function catchRedirectLocation(runGuard: () => unknown): string | null {
  try {
    runGuard()
    return null
  } catch (thrown) {
    if (thrown instanceof Response) return thrown.headers.get('Location')
    throw thrown
  }
}

function saveOpenEventSession(accessCode: string, isEventOpen = true) {
  saveParticipantSession({
    accessToken: 'participant-token',
    eventId: 1,
    eventName: '2026 가을 축제',
    accessCode,
    isEventOpen,
  })
}

describe('requireParticipantSession', () => {
  it('입장 정보가 없으면 주소의 코드로 자동 입장(①-0)한 뒤 원래 화면으로 돌아오게 한다', () => {
    const location = catchRedirectLocation(() =>
      requireParticipantSession(loaderArguments('/e/A7K2Q9/all', { code: 'A7K2Q9' })),
    )

    expect(location).toBe('/e/A7K2Q9?next=%2Fe%2FA7K2Q9%2Fall')
  })

  it('다른 행사에 입장해 있으면 이 행사로 다시 입장한다', () => {
    saveOpenEventSession('G7R4D2')

    const location = catchRedirectLocation(() =>
      requireParticipantSession(loaderArguments('/e/A7K2Q9/all', { code: 'A7K2Q9' })),
    )

    expect(location).toBe('/e/A7K2Q9?next=%2Fe%2FA7K2Q9%2Fall')
  })

  it('주소의 코드가 소문자여도 같은 행사로 본다', () => {
    saveOpenEventSession('A7K2Q9')

    const location = catchRedirectLocation(() =>
      requireParticipantSession(loaderArguments('/e/a7k2q9/all', { code: 'a7k2q9' })),
    )

    expect(location).toBeNull()
  })

  it('입장 정보 없이 소문자 코드로 오면 대문자 코드로 자동 입장한다', () => {
    const location = catchRedirectLocation(() =>
      requireParticipantSession(loaderArguments('/e/a7k2q9/all', { code: 'a7k2q9' })),
    )

    expect(location).toBe('/e/A7K2Q9?next=%2Fe%2Fa7k2q9%2Fall')
  })

  it('같은 행사에 입장해 있으면 통과한다', () => {
    saveOpenEventSession('A7K2Q9')

    const location = catchRedirectLocation(() =>
      requireParticipantSession(loaderArguments('/e/A7K2Q9/all', { code: 'A7K2Q9' })),
    )

    expect(location).toBeNull()
  })
})

describe('requireOpenEvent', () => {
  it('공개 전 행사면 ①-1 사진 정리 중으로 보낸다', () => {
    saveOpenEventSession('M3T8K5', false)

    const location = catchRedirectLocation(() =>
      requireOpenEvent(loaderArguments('/e/M3T8K5/home', { code: 'M3T8K5' })),
    )

    expect(location).toBe('/e/M3T8K5/preparing')
  })

  it('입장 정보가 없으면 먼저 자동 입장으로 보낸다(검색어까지 보존)', () => {
    const location = catchRedirectLocation(() =>
      requireOpenEvent(loaderArguments('/e/A7K2Q9/photos?persons=3,12', { code: 'A7K2Q9' })),
    )

    expect(location).toBe('/e/A7K2Q9?next=%2Fe%2FA7K2Q9%2Fphotos%3Fpersons%3D3%2C12')
  })

  it('공개된 행사면 통과한다', () => {
    saveOpenEventSession('A7K2Q9')

    const location = catchRedirectLocation(() =>
      requireOpenEvent(loaderArguments('/e/A7K2Q9/home', { code: 'A7K2Q9' })),
    )

    expect(location).toBeNull()
  })
})

describe('관리자 가드', () => {
  it('로그인하지 않았으면 로그인 화면으로 보내고, 로그인 뒤 돌아올 주소를 붙인다', () => {
    const location = catchRedirectLocation(() =>
      requireAdministratorSession(loaderArguments('/admin/events/5/processing')),
    )

    expect(location).toBe('/admin/login?next=%2Fadmin%2Fevents%2F5%2Fprocessing')
  })

  it('로그인했으면 통과한다', () => {
    saveAdministratorSession({ accessToken: 'token', expiresInSeconds: 3600, loginId: 'admin' })

    const location = catchRedirectLocation(() =>
      requireAdministratorSession(loaderArguments('/admin/events')),
    )

    expect(location).toBeNull()
  })

  it('이미 로그인했는데 로그인 화면에 오면 최근 행사로 보낸다', () => {
    saveAdministratorSession({ accessToken: 'token', expiresInSeconds: 3600, loginId: 'admin' })

    const location = catchRedirectLocation(() =>
      redirectSignedInAdministrator(loaderArguments('/admin/login')),
    )

    expect(location).toBe('/admin/events')
  })

  it('이미 로그인했고 돌아갈 주소가 있으면 그리로 보낸다', () => {
    saveAdministratorSession({ accessToken: 'token', expiresInSeconds: 3600, loginId: 'admin' })

    const location = catchRedirectLocation(() =>
      redirectSignedInAdministrator(
        loaderArguments('/admin/login?next=%2Fadmin%2Fevents%2F5%2Fresult'),
      ),
    )

    expect(location).toBe('/admin/events/5/result')
  })
})
