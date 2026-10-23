import { describe, expect, it } from 'vitest'
import { getSafeNextPath } from '@/shared/lib/safe-next-path'

describe('getSafeNextPath', () => {
  it('우리 사이트 안의 주소는 그대로 쓴다', () => {
    expect(getSafeNextPath('/e/A7K2Q9/photos?persons=3,12', '/')).toBe(
      '/e/A7K2Q9/photos?persons=3,12',
    )
  })

  it('값이 없으면 기본 주소를 쓴다', () => {
    expect(getSafeNextPath(null, '/admin/events')).toBe('/admin/events')
    expect(getSafeNextPath('', '/admin/events')).toBe('/admin/events')
  })

  it('다른 사이트로 보내는 주소는 막는다(입장·로그인 뒤 피싱 사이트로 넘어가지 않게)', () => {
    expect(getSafeNextPath('https://evil.example.com', '/')).toBe('/')
    expect(getSafeNextPath('//evil.example.com/path', '/')).toBe('/')
    expect(getSafeNextPath('/\\evil.example.com', '/')).toBe('/')
    expect(getSafeNextPath('javascript:alert(1)', '/')).toBe('/')
  })
})
