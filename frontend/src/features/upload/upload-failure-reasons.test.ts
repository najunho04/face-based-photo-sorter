import { describe, expect, it } from 'vitest'
import { summarizeUploadFailureReasons } from '@/features/upload/upload-failure-reasons'

// 휴대폰 실패 상자(시안 M2): 파일 목록 대신 "네트워크 오류 1 · 지원하지 않는 형식 1"처럼 이유별 장 수만 보여 준다
describe('업로드 실패 이유 요약', () => {
  it('같은 이유끼리 세서 처음 나온 순서대로 이어 붙인다', () => {
    expect(summarizeUploadFailureReasons(['NETWORK_ERROR', 'UNSUPPORTED_FILE'])).toBe(
      '네트워크 오류 1 · 지원하지 않는 형식 1',
    )
    expect(
      summarizeUploadFailureReasons(['UNSUPPORTED_FILE', 'NETWORK_ERROR', 'UNSUPPORTED_FILE']),
    ).toBe('지원하지 않는 형식 2 · 네트워크 오류 1')
  })

  it('모르는 이유나 이유가 없으면 "올리지 못함"으로 묶는다', () => {
    expect(summarizeUploadFailureReasons([null, 'SOMETHING_NEW'])).toBe('올리지 못함 2')
  })

  it('실패가 없으면 빈 문자열', () => {
    expect(summarizeUploadFailureReasons([])).toBe('')
  })
})
