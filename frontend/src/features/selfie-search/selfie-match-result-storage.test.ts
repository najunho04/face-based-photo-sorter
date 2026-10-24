import { afterEach, describe, expect, it } from 'vitest'
import type { Person } from '@/entities/person/person-types'
import {
  clearSelfieMatchResult,
  readSelfieMatchResult,
  saveSelfieMatchResult,
} from '@/features/selfie-search/selfie-match-result-storage'

afterEach(() => sessionStorage.clear())

const candidate: Person = {
  personId: 10003,
  label: 'user3',
  photoCount: 16,
  repFace: { url: 'https://storage.example/10006.jpg', bbox: { x: 1, y: 2, w: 3, h: 4 } },
}

describe('셀카 검색 결과 보관(④를 새로고침해도 유지)', () => {
  it('후보 목록을 저장하고 읽는다', () => {
    saveSelfieMatchResult(1, { kind: 'candidates', candidates: [candidate] })

    expect(readSelfieMatchResult(1)).toEqual({ kind: 'candidates', candidates: [candidate] })
  })

  it('후보 없음·얼굴 없음 결과도 저장한다', () => {
    saveSelfieMatchResult(1, { kind: 'no-match' })
    saveSelfieMatchResult(2, { kind: 'no-face' })

    expect(readSelfieMatchResult(1)).toEqual({ kind: 'no-match' })
    expect(readSelfieMatchResult(2)).toEqual({ kind: 'no-face' })
  })

  it('행사마다 따로 저장하고, 지우면 없는 것으로 읽힌다', () => {
    saveSelfieMatchResult(1, { kind: 'no-match' })
    clearSelfieMatchResult(1)

    expect(readSelfieMatchResult(1)).toBeNull()
  })

  it('탭을 닫으면 사라지는 sessionStorage에 저장한다(셀카 사진은 저장하지 않음)', () => {
    saveSelfieMatchResult(1, { kind: 'candidates', candidates: [candidate] })

    expect(sessionStorage.length).toBe(1)
    expect(localStorage.length).toBe(0)
  })

  it('대표 얼굴이 비어 있는 후보도 그대로 저장하고 읽는다(백엔드가 대표 얼굴·주소를 비워 보낼 수 있음)', () => {
    const withoutFace: Person = { ...candidate, personId: 10004, repFace: null }
    const withoutUrl: Person = {
      ...candidate,
      personId: 10005,
      repFace: { url: null, bbox: { x: 1, y: 2, w: 3, h: 4 } },
    }
    saveSelfieMatchResult(1, { kind: 'candidates', candidates: [withoutFace, withoutUrl] })

    expect(readSelfieMatchResult(1)).toEqual({
      kind: 'candidates',
      candidates: [withoutFace, withoutUrl],
    })
  })

  it('저장된 값의 모양이 다르면 없는 것으로 본다', () => {
    saveSelfieMatchResult(1, { kind: 'no-match' })
    sessionStorage.setItem(sessionStorage.key(0)!, JSON.stringify({ kind: 'unknown' }))

    expect(readSelfieMatchResult(1)).toBeNull()
  })
})
