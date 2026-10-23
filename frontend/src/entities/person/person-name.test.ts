import { describe, expect, it } from 'vitest'
import { formatPersonName, getPersonNumber } from '@/entities/person/person-name'

describe('getPersonNumber', () => {
  it('백엔드 폴더 이름(user3)에서 번호를 꺼낸다', () => {
    expect(getPersonNumber('user3')).toBe(3)
    expect(getPersonNumber('user48')).toBe(48)
  })

  it('번호가 없으면 null', () => {
    expect(getPersonNumber('unknown')).toBeNull()
  })
})

describe('formatPersonName', () => {
  it('화면에는 "사람 3"으로 보여 준다', () => {
    expect(formatPersonName('user3')).toBe('사람 3')
  })

  it('번호가 없는 이름은 그대로 보여 준다', () => {
    expect(formatPersonName('unknown')).toBe('unknown')
  })
})
