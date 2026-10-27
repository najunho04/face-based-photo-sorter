import { describe, expect, it } from 'vitest'
import { isUploadableImage } from '@/features/upload/uploadable-image'

// 테스트용 파일
function file(name: string, type: string) {
  return new File(['x'], name, { type })
}

describe('isUploadableImage (끌어다 놓은 파일·폴더에서 사진만 고르기)', () => {
  it('JPG·PNG·HEIC 사진은 받는다', () => {
    expect(isUploadableImage(file('a.jpg', 'image/jpeg'))).toBe(true)
    expect(isUploadableImage(file('b.png', 'image/png'))).toBe(true)
    expect(isUploadableImage(file('c.HEIC', ''))).toBe(true)
    expect(isUploadableImage(file('d.heif', 'image/heif'))).toBe(true)
  })

  it('사진이 아닌 파일·숨김 파일은 뺀다', () => {
    expect(isUploadableImage(file('notes.txt', 'text/plain'))).toBe(false)
    expect(isUploadableImage(file('video.mp4', 'video/mp4'))).toBe(false)
    expect(isUploadableImage(file('.DS_Store', ''))).toBe(false)
  })
})
