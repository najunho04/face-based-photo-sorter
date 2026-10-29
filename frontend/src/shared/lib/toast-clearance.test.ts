import { afterEach, describe, expect, it } from 'vitest'
import {
  clearToastClearance,
  setToastClearance,
  toastClearanceVariableName,
} from '@/shared/lib/toast-clearance'

// 아래 고정 막대가 있는 화면은 막대 높이만큼 토스트를 위로 올린다(시안 ⑤·⑥: 토스트는 막대 위에 뜸)
describe('토스트 아래 여백(아래 막대 높이)', () => {
  afterEach(() => clearToastClearance())

  const readClearance = () =>
    document.documentElement.style.getPropertyValue(toastClearanceVariableName)

  it('막대 높이를 px로 문서 최상단에 적어 둔다', () => {
    setToastClearance(77)
    expect(readClearance()).toBe('77px')
  })

  it('소수점 높이는 올림해서 막대에 걸치지 않게 한다', () => {
    setToastClearance(76.4)
    expect(readClearance()).toBe('77px')
  })

  it('높이가 0 이하이거나 숫자가 아니면 지운다', () => {
    setToastClearance(77)
    setToastClearance(0)
    expect(readClearance()).toBe('')
    setToastClearance(77)
    setToastClearance(Number.NaN)
    expect(readClearance()).toBe('')
  })

  it('화면을 떠나면 지워서 다른 화면의 토스트는 원래 자리에 뜬다', () => {
    setToastClearance(77)
    clearToastClearance()
    expect(readClearance()).toBe('')
  })
})
