import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api/api-error'
import { shouldRetryRequest } from '@/shared/api/query-client'

// 테스트용 ApiError를 짧게 만든다
function apiError(code: string, status: number | null) {
  return new ApiError({ code, status, serverMessage: null })
}

describe('shouldRetryRequest', () => {
  it('네트워크 끊김·시간 초과·서버 오류는 한 번만 다시 시도한다', () => {
    for (const code of ['NETWORK_ERROR', 'TIMEOUT', 'INTERNAL_ERROR']) {
      expect(shouldRetryRequest(0, apiError(code, null))).toBe(true)
      expect(shouldRetryRequest(1, apiError(code, null))).toBe(false)
    }
  })

  it('요청 자체가 잘못된 4xx 오류는 다시 시도하지 않는다', () => {
    for (const code of ['UNAUTHORIZED', 'FORBIDDEN', 'EVENT_NOT_READY', 'PERSON_NOT_FOUND']) {
      expect(shouldRetryRequest(0, apiError(code, 400))).toBe(false)
    }
  })

  it('ApiError가 아닌 오류(코드 실수 등)는 다시 시도하지 않는다', () => {
    expect(shouldRetryRequest(0, new TypeError('x is undefined'))).toBe(false)
  })
})
