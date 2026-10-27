// 가짜 토큰. 실제 JWT처럼 점(.)으로 나뉜 세 부분이지만 서명은 없다. 내용만 읽어 권한·만료를 흉내 낸다.

/** 토큰 유효 시간(초). 백엔드 기본값(docs/api.md #1의 expiresIn, 12시간)과 같게 */
export const mockTokenLifetimeSeconds = 43200

export type MockTokenPayload = {
  role: 'admin' | 'participant'
  /** 참가자 토큰만 행사 번호를 가진다 */
  eventId: number | null
  issuedAt: number
  expiresAt: number
}

// 역할과 행사 번호로 토큰을 만든다
export function createMockToken(role: MockTokenPayload['role'], eventId: number | null): string {
  const issuedAt = Date.now()
  const payload: MockTokenPayload = {
    role,
    eventId,
    issuedAt,
    expiresAt: issuedAt + mockTokenLifetimeSeconds * 1000,
  }
  return `mock.${btoa(JSON.stringify(payload))}.unsigned`
}

// 요청의 Authorization 헤더에서 토큰 내용을 꺼낸다. 없거나 모양이 다르면 null
export function readMockToken(request: Request): MockTokenPayload | null {
  const authorization = request.headers.get('authorization') ?? ''
  const [scheme, token] = authorization.split(' ')
  if (scheme !== 'Bearer' || !token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as Partial<MockTokenPayload>
    if (
      (payload.role !== 'admin' && payload.role !== 'participant') ||
      typeof payload.issuedAt !== 'number' ||
      typeof payload.expiresAt !== 'number'
    ) {
      return null
    }
    return {
      role: payload.role,
      eventId: payload.eventId ?? null,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    }
  } catch {
    return null
  }
}
