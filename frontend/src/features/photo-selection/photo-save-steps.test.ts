import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  downloadPhoto,
  prepareShareFiles,
  runSequentially,
} from '@/features/photo-selection/photo-save-steps'

describe('runSequentially (사진을 한 장씩 차례로 처리)', () => {
  it('차례대로 처리하고 진행 상황을 알린다', async () => {
    const handled: number[] = []
    const onProgress = vi.fn()

    const completedCount = await runSequentially(
      [1, 2, 3],
      async (item) => {
        handled.push(item)
      },
      { onProgress, gapMilliseconds: 0 },
    )

    expect(handled).toEqual([1, 2, 3])
    expect(completedCount).toBe(3)
    expect(onProgress.mock.calls.map((call) => call[0])).toEqual([1, 2, 3])
  })

  it('취소하면 남은 것은 처리하지 않는다', async () => {
    const abortController = new AbortController()
    const handled: number[] = []

    const completedCount = await runSequentially(
      [1, 2, 3],
      async (item) => {
        handled.push(item)
        if (item === 2) abortController.abort()
      },
      { signal: abortController.signal, gapMilliseconds: 0 },
    )

    expect(handled).toEqual([1, 2])
    expect(completedCount).toBe(2)
  })
})

describe('prepareShareFiles (공유 시트에 넘길 사진 파일 준비)', () => {
  const photos = [
    {
      photoId: 1,
      fileName: 'IMG_0001.jpg',
      url: 'https://storage/1',
      downloadUrl: 'https://storage/1?d',
    },
    {
      photoId: 2,
      fileName: 'IMG_0002',
      url: 'https://storage/2',
      downloadUrl: 'https://storage/2?d',
    },
  ]

  it('사진을 받아 이름이 있는 JPG 파일로 만든다', async () => {
    const fetchImage = vi.fn(async () => new Blob(['jpg'], { type: 'image/jpeg' }))

    const files = await prepareShareFiles(photos, { fetchImage, gapMilliseconds: 0 })

    expect(fetchImage).toHaveBeenCalledWith('https://storage/1?d', undefined)
    expect(files.map((file) => [file.name, file.type])).toEqual([
      ['IMG_0001.jpg', 'image/jpeg'],
      ['IMG_0002.jpg', 'image/jpeg'],
    ])
  })

  it('저장 주소가 없으면(⑦) 보기 주소로 받는다', async () => {
    const fetchImage = vi.fn(async () => new Blob(['jpg'], { type: 'image/jpeg' }))

    await prepareShareFiles([{ photoId: 3, fileName: 'a.jpg', url: 'https://storage/3' }], {
      fetchImage,
      gapMilliseconds: 0,
    })

    expect(fetchImage).toHaveBeenCalledWith('https://storage/3', undefined)
  })
})

describe('downloadPhoto (사진 한 장 내려받기)', () => {
  // 링크를 눌렀을 때의 주소·파일 이름을 기록한다(실제로 내려받지 않게 click을 바꿔치기)
  function recordLinkClicks() {
    const clicks: Array<{ href: string; download: string }> = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push({ href: this.href, download: this.download })
    })
    return clicks
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('저장 주소(downloadUrl)가 있으면 그 주소를 링크로 바로 연다(서버가 파일로 받기 헤더를 붙임)', async () => {
    const clicks = recordLinkClicks()
    const fetchImage = vi.fn()

    await downloadPhoto(
      {
        photoId: 1,
        fileName: 'IMG_0001',
        url: 'https://storage/1',
        downloadUrl: 'https://storage/1?d',
      },
      { fetchImage },
    )

    expect(fetchImage).not.toHaveBeenCalled()
    expect(clicks).toEqual([{ href: 'https://storage/1?d', download: 'IMG_0001.jpg' }])
  })

  it('저장 주소가 없으면(⑦) 사진을 받아 Blob 주소로 내려받는다(다른 도메인 주소는 download 속성이 무시되어 화면이 이미지로 넘어감)', async () => {
    vi.useFakeTimers()
    const clicks = recordLinkClicks()
    const imageBlob = new Blob(['jpg'], { type: 'image/jpeg' })
    const fetchImage = vi.fn(async () => imageBlob)
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:photo-3')
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await downloadPhoto({ photoId: 3, fileName: 'a.png', url: 'https://storage/3' }, { fetchImage })

    expect(fetchImage).toHaveBeenCalledWith('https://storage/3', undefined)
    expect(createObjectUrl).toHaveBeenCalledWith(imageBlob)
    expect(clicks).toEqual([{ href: 'blob:photo-3', download: 'a.jpg' }])
    // 내려받기가 시작될 시간을 준 뒤 임시 주소를 지운다
    expect(revokeObjectUrl).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:photo-3')
  })

  it('사진을 받지 못하면 실패를 그대로 알린다(부르는 쪽이 안내)', async () => {
    const clicks = recordLinkClicks()
    const fetchImage = vi.fn(async () => {
      throw new Error('CORS')
    })

    await expect(
      downloadPhoto({ photoId: 4, fileName: 'b.jpg', url: 'https://storage/4' }, { fetchImage }),
    ).rejects.toThrow('CORS')
    expect(clicks).toEqual([])
  })
})
