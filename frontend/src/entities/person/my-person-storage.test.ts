import { afterEach, describe, expect, it } from 'vitest'
import {
  addMyPersonIds,
  forgetMyPersonIds,
  readMyPersonIds,
  saveMyPersonIds,
} from '@/entities/person/my-person-storage'

afterEach(() => localStorage.clear())

describe('내 폴더 기억(②-2 바로가기)', () => {
  it('처음에는 빈 목록', () => {
    expect(readMyPersonIds(1)).toEqual([])
  })

  it('행사별로 저장한다(다른 행사와 섞이지 않게)', () => {
    saveMyPersonIds(1, [3, 12])
    saveMyPersonIds(2, [7])

    expect(readMyPersonIds(1)).toEqual([3, 12])
    expect(readMyPersonIds(2)).toEqual([7])
  })

  it('저장은 기존 목록을 바꾼다(셀카로 다시 찾은 경우)', () => {
    saveMyPersonIds(1, [3, 12])
    saveMyPersonIds(1, [5])

    expect(readMyPersonIds(1)).toEqual([5])
  })

  it('추가는 기존 목록에 더하고 겹치는 번호는 한 번만 둔다(⑤의 [이게 나예요])', () => {
    saveMyPersonIds(1, [3])
    addMyPersonIds(1, [12, 3])

    expect(readMyPersonIds(1)).toEqual([3, 12])
  })

  it('잊기는 그 행사 목록만 지운다', () => {
    saveMyPersonIds(1, [3])
    saveMyPersonIds(2, [7])
    forgetMyPersonIds(1)

    expect(readMyPersonIds(1)).toEqual([])
    expect(readMyPersonIds(2)).toEqual([7])
  })

  it('기기에 남는 localStorage에 사람 번호만 저장한다(사진·얼굴은 저장하지 않음)', () => {
    saveMyPersonIds(1, [3, 12])

    expect(sessionStorage.length).toBe(0)
    expect(localStorage.length).toBe(1)
    expect(localStorage.getItem(localStorage.key(0)!)).toBe('{"1":[3,12]}')
  })

  it('저장된 값이 깨져 있으면 빈 목록', () => {
    saveMyPersonIds(1, [3])
    localStorage.setItem(localStorage.key(0)!, '{"1":"not-array"}')

    expect(readMyPersonIds(1)).toEqual([])
  })
})
