import { describe, expect, it } from 'vitest'
import { chooseSaveMethod, splitIntoBatches } from '@/features/photo-selection/save-method'

const userAgents = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  // 아이패드는 기본으로 'PC 화면'을 요청해서 맥과 같은 사용자 에이전트를 보낸다(터치 지점 수로 구분)
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  android:
    'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
}

describe('chooseSaveMethod (결정: 아이폰은 공유 시트, 나머지는 다운로드)', () => {
  it('아이폰에서 파일 공유가 되면 공유 시트(사진 앱 저장)', () => {
    expect(
      chooseSaveMethod({ userAgent: userAgents.iphone, maxTouchPoints: 5, canShareFiles: true }),
    ).toBe('share-sheet')
  })

  it('아이폰이라도 파일 공유가 안 되면 다운로드', () => {
    expect(
      chooseSaveMethod({ userAgent: userAgents.iphone, maxTouchPoints: 5, canShareFiles: false }),
    ).toBe('download')
  })

  it('PC 화면 모드의 아이패드도 공유 시트', () => {
    expect(
      chooseSaveMethod({
        userAgent: userAgents.ipadDesktopMode,
        maxTouchPoints: 5,
        canShareFiles: true,
      }),
    ).toBe('share-sheet')
  })

  it('맥(터치 없음)은 다운로드', () => {
    expect(
      chooseSaveMethod({
        userAgent: userAgents.ipadDesktopMode,
        maxTouchPoints: 0,
        canShareFiles: true,
      }),
    ).toBe('download')
  })

  it('안드로이드는 파일 공유가 되어도 다운로드(갤러리 Download 앨범)', () => {
    expect(
      chooseSaveMethod({ userAgent: userAgents.android, maxTouchPoints: 5, canShareFiles: true }),
    ).toBe('download')
  })
})

describe('splitIntoBatches (안드로이드 공유 시트는 한 번에 약 10장)', () => {
  it('정해진 크기로 나눈다', () => {
    expect(splitIntoBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('빈 목록은 빈 묶음', () => {
    expect(splitIntoBatches([], 10)).toEqual([])
  })
})
