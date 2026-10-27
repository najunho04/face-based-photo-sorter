import { http, HttpResponse, delay } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/api-error'
import { requestApi, setUnauthorizedListener } from '@/shared/api/client'
import {
  clearAllSessions,
  saveAdministratorSession,
  saveParticipantSession,
} from '@/shared/api/token-storage'

// 테스트마다 필요한 응답만 server.use로 정한다. 정하지 않은 요청이 나가면 테스트를 실패시킨다
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  clearAllSessions()
})
afterAll(() => server.close())

// 백엔드 공통 응답 형식으로 성공 본문을 만든다
function successBody(data: unknown) {
  return { success: true, data, error: null }
}

// 백엔드 공통 응답 형식으로 실패 본문을 만든다
function failureBody(code: string, message: string) {
  return { success: false, data: null, error: { code, message } }
}

describe('requestApi 성공 응답', () => {
  it('공통 응답에서 data만 꺼내 돌려준다', async () => {
    server.use(http.get('*/api/ping', () => HttpResponse.json(successBody({ value: 1 }))))

    await expect(requestApi('/api/ping', { requester: 'anonymous' })).resolves.toEqual({
      value: 1,
    })
  })

  it('JSON 본문은 Content-Type과 함께 보낸다', async () => {
    let receivedContentType: string | null = null
    let receivedBody: unknown = null
    server.use(
      http.post('*/api/echo', async ({ request }) => {
        receivedContentType = request.headers.get('content-type')
        receivedBody = await request.json()
        return HttpResponse.json(successBody(null))
      }),
    )

    await requestApi('/api/echo', {
      method: 'POST',
      requester: 'anonymous',
      jsonBody: { accessCode: 'A7K2Q9' },
    })

    expect(receivedContentType).toContain('application/json')
    expect(receivedBody).toEqual({ accessCode: 'A7K2Q9' })
  })

  it('쿼리 값 중 비어 있는 것은 빼고 붙인다', async () => {
    let receivedSearch = ''
    server.use(
      http.get('*/api/list', ({ request }) => {
        receivedSearch = new URL(request.url).search
        return HttpResponse.json(successBody([]))
      }),
    )

    await requestApi('/api/list', {
      requester: 'anonymous',
      query: { page: 2, size: 30, minPhotos: undefined },
    })

    expect(receivedSearch).toBe('?page=2&size=30')
  })
})

describe('requestApi 토큰', () => {
  it('관리자 요청에는 관리자 토큰을 붙인다', async () => {
    let receivedAuthorization: string | null = null
    server.use(
      http.get('*/api/admin/thing', ({ request }) => {
        receivedAuthorization = request.headers.get('authorization')
        return HttpResponse.json(successBody(null))
      }),
    )
    saveAdministratorSession({
      accessToken: 'administrator-token',
      expiresInSeconds: 3600,
      loginId: 'admin',
    })
    saveParticipantSession({
      accessToken: 'participant-token',
      eventId: 1,
      eventName: '행사',
      accessCode: 'A7K2Q9',
      isEventOpen: true,
    })

    await requestApi('/api/admin/thing', { requester: 'administrator' })

    expect(receivedAuthorization).toBe('Bearer administrator-token')
  })

  it('참가자 요청에는 참가자 토큰을 붙인다', async () => {
    let receivedAuthorization: string | null = null
    server.use(
      http.get('*/api/events/1/persons', ({ request }) => {
        receivedAuthorization = request.headers.get('authorization')
        return HttpResponse.json(successBody(null))
      }),
    )
    saveParticipantSession({
      accessToken: 'participant-token',
      eventId: 1,
      eventName: '행사',
      accessCode: 'A7K2Q9',
      isEventOpen: true,
    })

    await requestApi('/api/events/1/persons', { requester: 'participant' })

    expect(receivedAuthorization).toBe('Bearer participant-token')
  })

  it('로그인·입장 같은 익명 요청에는 토큰을 붙이지 않는다', async () => {
    let receivedAuthorization: string | null = 'not checked'
    server.use(
      http.post('*/api/events/join', ({ request }) => {
        receivedAuthorization = request.headers.get('authorization')
        return HttpResponse.json(successBody(null))
      }),
    )
    saveParticipantSession({
      accessToken: 'participant-token',
      eventId: 1,
      eventName: '행사',
      accessCode: 'A7K2Q9',
      isEventOpen: true,
    })

    await requestApi('/api/events/join', { method: 'POST', requester: 'anonymous' })

    expect(receivedAuthorization).toBeNull()
  })
})

describe('requestApi 실패 응답 → ApiError', () => {
  it('공통 실패 응답의 error.code·message·HTTP 상태를 담는다', async () => {
    server.use(
      http.post('*/api/events/join', () =>
        HttpResponse.json(failureBody('INVALID_ACCESS_CODE', '인증코드가 없습니다.'), {
          status: 404,
        }),
      ),
    )

    const error = await requestApi('/api/events/join', {
      method: 'POST',
      requester: 'anonymous',
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      code: 'INVALID_ACCESS_CODE',
      status: 404,
      serverMessage: '인증코드가 없습니다.',
    })
  })

  it('JSON이 아닌 413 응답(앞단 서버가 막음)은 FILE_TOO_LARGE로 바꾼다', async () => {
    server.use(
      http.post(
        '*/api/admin/events/1/photos',
        () => new HttpResponse('<html>413 Request Entity Too Large</html>', { status: 413 }),
      ),
    )

    await expect(
      requestApi('/api/admin/events/1/photos', { method: 'POST', requester: 'administrator' }),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE', status: 413 })
  })

  it('JSON이 아닌 5xx 응답은 INTERNAL_ERROR로 바꾼다', async () => {
    server.use(
      http.get(
        '*/api/ping',
        () => new HttpResponse('<html>502 Bad Gateway</html>', { status: 502 }),
      ),
    )

    await expect(requestApi('/api/ping', { requester: 'anonymous' })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 502,
    })
  })

  it('200이지만 공통 응답 형식이 아니면(주소가 틀려 index.html이 옴) UNKNOWN_ERROR로 바꾼다', async () => {
    server.use(
      http.get('*/api/ping', () => HttpResponse.html('<!doctype html><title>인생내컷</title>')),
    )

    await expect(requestApi('/api/ping', { requester: 'anonymous' })).rejects.toMatchObject({
      code: 'UNKNOWN_ERROR',
      status: 200,
    })
  })

  it('네트워크가 끊기면 NETWORK_ERROR로 바꾼다', async () => {
    server.use(http.get('*/api/ping', () => HttpResponse.error()))

    await expect(requestApi('/api/ping', { requester: 'anonymous' })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: null,
    })
  })

  it('정한 시간 안에 답이 없으면 TIMEOUT으로 바꾼다', async () => {
    server.use(
      http.get('*/api/ping', async () => {
        await delay('infinite')
        return HttpResponse.json(successBody(null))
      }),
    )

    await expect(
      requestApi('/api/ping', { requester: 'anonymous', timeoutMilliseconds: 50 }),
    ).rejects.toMatchObject({ code: 'TIMEOUT', status: null })
  })

  it('호출한 쪽이 취소하면 ApiError로 바꾸지 않고 취소 오류를 그대로 던진다', async () => {
    server.use(
      http.get('*/api/ping', async () => {
        await delay('infinite')
        return HttpResponse.json(successBody(null))
      }),
    )
    const abortController = new AbortController()

    const request = requestApi('/api/ping', {
      requester: 'anonymous',
      signal: abortController.signal,
    })
    // 응답을 기다리는 도중에 취소한다(화면을 떠나는 상황). 요청을 시작한 바로 그 순간의 취소는
    // 테스트 환경(happy-dom)의 fetch가 놓치므로 잠깐 기다린 뒤 취소한다
    await new Promise((resolve) => setTimeout(resolve, 20))
    abortController.abort()

    const error = await request.catch((caught: unknown) => caught)
    expect(error).not.toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ name: 'AbortError' })
  })
})

describe('requestApi 401 처리', () => {
  it('UNAUTHORIZED면 누가 요청했는지와 함께 알린다', async () => {
    server.use(
      http.get('*/api/events/1/persons', () =>
        HttpResponse.json(failureBody('UNAUTHORIZED', '토큰이 만료되었습니다.'), { status: 401 }),
      ),
    )
    const unauthorizedListener = vi.fn()
    const removeListener = setUnauthorizedListener(unauthorizedListener)

    await requestApi('/api/events/1/persons', { requester: 'participant' }).catch(() => {})

    expect(unauthorizedListener).toHaveBeenCalledWith('participant')
    removeListener()
  })

  it('LOGIN_FAILED는 같은 401이어도 알리지 않는다(로그인 화면에서 문구만 보여 줌)', async () => {
    server.use(
      http.post('*/api/admin/login', () =>
        HttpResponse.json(failureBody('LOGIN_FAILED', '아이디 또는 비밀번호가 다릅니다.'), {
          status: 401,
        }),
      ),
    )
    const unauthorizedListener = vi.fn()
    const removeListener = setUnauthorizedListener(unauthorizedListener)

    await requestApi('/api/admin/login', { method: 'POST', requester: 'anonymous' }).catch(() => {})

    expect(unauthorizedListener).not.toHaveBeenCalled()
    removeListener()
  })
})
