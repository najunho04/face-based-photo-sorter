import { describe, expect, it, vi } from 'vitest'
import { markTitleAsCompleted, showCompletionNotification } from '@/pages/admin/completion-alert'

describe('markTitleAsCompleted (탭 제목에 완료 표시)', () => {
  it("탭 제목 앞에 '(완료)'를 붙인다", () => {
    expect(markTitleAsCompleted('사진 정리 중 · 인생내컷')).toBe('(완료) 사진 정리 중 · 인생내컷')
  })

  it('이미 붙어 있으면 또 붙이지 않는다', () => {
    expect(markTitleAsCompleted('(완료) 사진 정리 중 · 인생내컷')).toBe(
      '(완료) 사진 정리 중 · 인생내컷',
    )
  })
})

describe('showCompletionNotification (브라우저 알림 보내기)', () => {
  it('알림을 만들고 true를 돌려준다', () => {
    const NotificationConstructor = vi.fn()

    const isShown = showCompletionNotification({
      title: '사진 정리가 끝났어요',
      body: '2026 가을 축제 · 참가자에게 공개됐어요',
      NotificationConstructor,
    })

    expect(isShown).toBe(true)
    expect(NotificationConstructor).toHaveBeenCalledWith('사진 정리가 끝났어요', {
      body: '2026 가을 축제 · 참가자에게 공개됐어요',
    })
  })

  it('안드로이드 Chrome처럼 알림 생성자가 예외를 던지면 false를 돌려주고 화면을 깨뜨리지 않는다', () => {
    const NotificationConstructor = vi.fn(() => {
      throw new TypeError("Failed to construct 'Notification': Illegal constructor.")
    })

    expect(() =>
      showCompletionNotification({ title: '끝', body: '', NotificationConstructor }),
    ).not.toThrow()
    expect(showCompletionNotification({ title: '끝', body: '', NotificationConstructor })).toBe(
      false,
    )
  })
})
