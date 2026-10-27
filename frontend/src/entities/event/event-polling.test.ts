import { describe, expect, it } from 'vitest'
import { getProgressPollingInterval } from '@/entities/event/event-polling'

describe('getProgressPollingInterval (#5 진행 상황을 다시 받을 간격)', () => {
  it('서버가 정리하는 중(얼굴 찾기·묶기)에는 정해진 간격으로 다시 받는다', () => {
    expect(getProgressPollingInterval('extracting', 3000)).toBe(3000)
    expect(getProgressPollingInterval('clustering', 10_000)).toBe(10_000)
  })

  it('업로드 중은 관리자가 완료를 누르기 전에는 바뀌지 않으므로 다시 받지 않는다', () => {
    expect(getProgressPollingInterval('uploading', 10_000)).toBe(false)
  })

  it('공개되면 더는 바뀌지 않으므로 다시 받지 않는다', () => {
    expect(getProgressPollingInterval('open', 3000)).toBe(false)
  })

  it('간격을 정하지 않았거나 아직 상태를 모르면 다시 받지 않는다', () => {
    expect(getProgressPollingInterval('extracting', undefined)).toBe(false)
    expect(getProgressPollingInterval(undefined, 3000)).toBe(false)
  })
})
