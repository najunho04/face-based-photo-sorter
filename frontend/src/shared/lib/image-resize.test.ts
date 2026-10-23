import { describe, expect, it } from 'vitest'
import { calculateResizedDimensions } from '@/shared/lib/image-resize'

describe('calculateResizedDimensions (긴 변 기준으로 줄일 크기)', () => {
  it('가로 사진은 가로를 최대 길이로 맞추고 비율을 지킨다', () => {
    expect(calculateResizedDimensions(4032, 3024, 1024)).toEqual({ width: 1024, height: 768 })
  })

  it('세로 사진은 세로를 최대 길이로 맞춘다', () => {
    expect(calculateResizedDimensions(3024, 4032, 1024)).toEqual({ width: 768, height: 1024 })
  })

  it('이미 작은 사진은 키우지 않는다', () => {
    expect(calculateResizedDimensions(800, 600, 1024)).toEqual({ width: 800, height: 600 })
  })

  it('소수점은 반올림하고 0이 되지 않게 한다', () => {
    expect(calculateResizedDimensions(3000, 1001, 2000)).toEqual({ width: 2000, height: 667 })
    expect(calculateResizedDimensions(5000, 1, 1000)).toEqual({ width: 1000, height: 1 })
  })
})
