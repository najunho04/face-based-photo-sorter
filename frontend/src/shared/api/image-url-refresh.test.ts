import { describe, expect, it } from 'vitest'
import { getImageUrlRefreshMilliseconds } from '@/shared/api/image-url-refresh'

describe('getImageUrlRefreshMilliseconds (이미지 주소가 만료되기 전에 목록 다시 받기)', () => {
  it('만료 시간의 80%가 지나면 다시 받는다', () => {
    expect(getImageUrlRefreshMilliseconds(3600)).toBe(2_880_000)
  })

  it('만료가 아주 짧아도 30초보다 자주 받지는 않는다', () => {
    expect(getImageUrlRefreshMilliseconds(10)).toBe(30_000)
  })

  it('만료 시간을 모르면(목록이 비었거나 값 없음) 다시 받지 않는다', () => {
    expect(getImageUrlRefreshMilliseconds(undefined)).toBeNull()
  })
})
