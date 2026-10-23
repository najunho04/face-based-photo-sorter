import { describe, expect, it } from 'vitest'
import { normalizeAccessCode } from '@/entities/session/access-code'

describe('normalizeAccessCode', () => {
  it('소문자를 대문자로 바꾼다', () => {
    expect(normalizeAccessCode('a7k2q9')).toBe('A7K2Q9')
  })

  it('공백과 하이픈을 뺀다(단톡방에서 "A7K 2Q9", "A7K-2Q9"처럼 복사해 와도 되게)', () => {
    expect(normalizeAccessCode(' A7K 2Q9 ')).toBe('A7K2Q9')
    expect(normalizeAccessCode('a7k-2q9')).toBe('A7K2Q9')
  })

  it('빈 값은 빈 값', () => {
    expect(normalizeAccessCode('   ')).toBe('')
  })
})
