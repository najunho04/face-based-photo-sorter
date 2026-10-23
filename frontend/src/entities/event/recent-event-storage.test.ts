import { afterEach, describe, expect, it } from 'vitest'
import {
  addRecentEvent,
  readRecentEventIds,
  removeRecentEvent,
} from '@/entities/event/recent-event-storage'

afterEach(() => localStorage.clear())

describe('최근 행사 기억(A2, 관리자 행사 목록 API가 없어서)', () => {
  it('처음에는 빈 목록', () => {
    expect(readRecentEventIds()).toEqual([])
  })

  it('최근에 만든 행사가 앞에 온다', () => {
    addRecentEvent(1)
    addRecentEvent(5)

    expect(readRecentEventIds()).toEqual([5, 1])
  })

  it('이미 있는 행사를 다시 넣으면 맨 앞으로 옮긴다', () => {
    addRecentEvent(1)
    addRecentEvent(5)
    addRecentEvent(1)

    expect(readRecentEventIds()).toEqual([1, 5])
  })

  it('목록에서 지울 수 있다', () => {
    addRecentEvent(1)
    addRecentEvent(5)
    removeRecentEvent(1)

    expect(readRecentEventIds()).toEqual([5])
  })

  it('기기에 남는 localStorage에 저장한다', () => {
    addRecentEvent(1)

    expect(localStorage.length).toBe(1)
  })
})
