import { describe, expect, it, vi } from 'vitest'
import { prepareShareFiles, runSequentially } from '@/features/photo-selection/photo-save-steps'

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
