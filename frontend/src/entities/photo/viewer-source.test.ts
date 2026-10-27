import { describe, expect, it } from 'vitest'
import {
  parsePersonIdsParameter,
  readViewerSource,
  viewerSourceToQuery,
} from '@/entities/photo/viewer-source'

describe('parsePersonIdsParameter (주소의 persons=3,12)', () => {
  it('쉼표로 나눈 번호를 읽는다', () => {
    expect(parsePersonIdsParameter('3,12')).toEqual([3, 12])
  })

  it('잘못된 값·중복은 뺀다', () => {
    expect(parsePersonIdsParameter('a,0,-1,5,5, 7')).toEqual([5, 7])
  })

  it('값이 없으면 빈 목록', () => {
    expect(parsePersonIdsParameter(null)).toEqual([])
  })
})

describe('⑥ 크게 보기가 어떤 목록에서 열렸는지', () => {
  it('사람 폴더(⑤)에서 열었으면 사람 번호 목록', () => {
    expect(readViewerSource(new URLSearchParams('persons=3,12'))).toEqual({
      kind: 'persons',
      personIds: [3, 12],
    })
  })

  it('전체 사진(⑦)에서 열었으면 all', () => {
    expect(readViewerSource(new URLSearchParams('from=all'))).toEqual({ kind: 'all' })
  })

  it('정보가 없으면 null(사람별 사진으로 돌려보냄)', () => {
    expect(readViewerSource(new URLSearchParams(''))).toBeNull()
  })

  it('주소 검색어로 다시 바꾼다', () => {
    expect(viewerSourceToQuery({ kind: 'persons', personIds: [3, 12] })).toBe('persons=3,12')
    expect(viewerSourceToQuery({ kind: 'all' })).toBe('from=all')
  })
})
