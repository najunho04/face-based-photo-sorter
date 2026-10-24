import { describe, expect, it, vi } from 'vitest'
import {
  createUploadQueue,
  UploadPreparationError,
  type UploadBatchResult,
} from '@/features/upload/upload-queue'
import { ApiError } from '@/shared/api/api-error'

// 테스트용 사진 파일(이름만 다르게)
function createFiles(count: number, prefix = 'IMG'): File[] {
  return Array.from(
    { length: count },
    (_, index) =>
      new File(['jpg'], `${prefix}_${index + 1}.jpg`, { type: 'image/jpeg', lastModified: 1 }),
  )
}

const succeedAll = async (files: File[]): Promise<UploadBatchResult> => ({
  uploaded: files.length,
  failed: [],
})

// 기본 옵션: 준비(줄이기)는 그대로 돌려주고, 다시 시도는 기다리지 않는다
function createTestQueue(overrides: Partial<Parameters<typeof createUploadQueue>[0]> = {}) {
  return createUploadQueue({
    prepareFile: async (file) => file,
    uploadBatch: succeedAll,
    retryDelayMilliseconds: () => 0,
    ...overrides,
  })
}

describe('UploadQueue 묶음·동시 요청', () => {
  it('요청당 4장씩, 동시에 2요청까지 보낸다', async () => {
    let activeCount = 0
    let maxActiveCount = 0
    const batchSizes: number[] = []
    const queue = createTestQueue({
      uploadBatch: async (files) => {
        activeCount += 1
        maxActiveCount = Math.max(maxActiveCount, activeCount)
        batchSizes.push(files.length)
        await new Promise((resolve) => setTimeout(resolve, 5))
        activeCount -= 1
        return succeedAll(files)
      },
    })

    queue.add(createFiles(10))
    await queue.waitUntilIdle()

    expect(batchSizes).toEqual([4, 4, 2])
    expect(maxActiveCount).toBe(2)
    expect(queue.getSnapshot()).toMatchObject({
      totalCount: 10,
      doneCount: 10,
      failedCount: 0,
      isIdle: true,
    })
  })

  it('바뀔 때마다 진행 상황을 알린다', async () => {
    const onChange = vi.fn()
    const queue = createTestQueue({ onChange })

    queue.add(createFiles(2))
    await queue.waitUntilIdle()

    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ doneCount: 2, isIdle: true })
  })
})

describe('UploadQueue 실패 처리', () => {
  it('서버가 파일 하나를 거절하면 그 파일만 실패로 남긴다', async () => {
    const queue = createTestQueue({
      uploadBatch: async (files) => ({
        uploaded: files.length - 1,
        failed: [{ fileName: 'IMG_2.jpg', reason: 'UNSUPPORTED_FILE' }],
      }),
    })

    queue.add(createFiles(3))
    await queue.waitUntilIdle()

    const snapshot = queue.getSnapshot()
    expect(snapshot.doneCount).toBe(2)
    expect(snapshot.items.find((item) => item.fileName === 'IMG_2.jpg')).toMatchObject({
      status: 'failed',
      failureReason: 'UNSUPPORTED_FILE',
    })
  })

  it('줄이기(준비)에 실패한 파일은 보내지 않고 실패로 남긴다', async () => {
    const uploadedNames: string[] = []
    const queue = createTestQueue({
      prepareFile: async (file) => {
        if (file.name === 'IMG_1.jpg') throw new UploadPreparationError('UNSUPPORTED_FILE')
        return file
      },
      uploadBatch: async (files) => {
        uploadedNames.push(...files.map((file) => file.name))
        return succeedAll(files)
      },
    })

    queue.add(createFiles(3))
    await queue.waitUntilIdle()

    expect(uploadedNames).toEqual(['IMG_2.jpg', 'IMG_3.jpg'])
    expect(queue.getSnapshot().items[0]).toMatchObject({
      status: 'failed',
      failureReason: 'UNSUPPORTED_FILE',
    })
  })

  it('네트워크 오류는 다시 보내서 성공하면 완료', async () => {
    let callCount = 0
    const queue = createTestQueue({
      uploadBatch: async (files) => {
        callCount += 1
        if (callCount === 1)
          throw new ApiError({ code: 'NETWORK_ERROR', status: null, serverMessage: null })
        return succeedAll(files)
      },
    })

    queue.add(createFiles(2))
    await queue.waitUntilIdle()

    expect(callCount).toBe(2)
    expect(queue.getSnapshot()).toMatchObject({ doneCount: 2, failedCount: 0 })
    expect(queue.getSnapshot().items[0].attemptCount).toBe(2)
  })

  it('3번 모두 실패하면 실패로 남긴다', async () => {
    const uploadBatch = vi.fn(async () => {
      throw new ApiError({ code: 'INTERNAL_ERROR', status: 500, serverMessage: null })
    })
    const queue = createTestQueue({ uploadBatch })

    queue.add(createFiles(1))
    await queue.waitUntilIdle()

    expect(uploadBatch).toHaveBeenCalledTimes(3)
    expect(queue.getSnapshot().items[0]).toMatchObject({
      status: 'failed',
      failureReason: 'INTERNAL_ERROR',
      attemptCount: 3,
    })
  })

  it('다시 보내도 같은 오류(완료 후 업로드 등)는 바로 실패로 남긴다', async () => {
    const uploadBatch = vi.fn(async () => {
      throw new ApiError({ code: 'INVALID_STATUS', status: 409, serverMessage: null })
    })
    const queue = createTestQueue({ uploadBatch })

    queue.add(createFiles(2))
    await queue.waitUntilIdle()

    expect(uploadBatch).toHaveBeenCalledTimes(1)
    expect(queue.getSnapshot().failedCount).toBe(2)
  })

  it('실패한 사진만 다시 보낼 수 있다', async () => {
    let shouldFail = true
    const queue = createTestQueue({
      uploadBatch: async (files) => {
        if (shouldFail)
          throw new ApiError({ code: 'INVALID_STATUS', status: 409, serverMessage: null })
        return succeedAll(files)
      },
    })
    queue.add(createFiles(2))
    await queue.waitUntilIdle()

    shouldFail = false
    queue.retryFailed()
    await queue.waitUntilIdle()

    expect(queue.getSnapshot()).toMatchObject({ doneCount: 2, failedCount: 0 })
  })
})

describe('UploadQueue 추가·취소', () => {
  it('같은 파일(이름·크기·수정 시각)을 또 고르면 빼고 넣은 개수를 돌려준다', async () => {
    const queue = createTestQueue()
    const files = createFiles(3)

    expect(queue.add(files)).toBe(3)
    expect(queue.add([files[0], ...createFiles(1, 'NEW')])).toBe(1)
    await queue.waitUntilIdle()

    expect(queue.getSnapshot().totalCount).toBe(4)
  })

  it('취소하면 보내는 중인 요청을 멈춘다', async () => {
    let receivedSignal: AbortSignal | undefined
    const queue = createTestQueue({
      uploadBatch: (_files, signal) => {
        receivedSignal = signal
        return new Promise(() => {})
      },
    })

    queue.add(createFiles(2))
    await new Promise((resolve) => setTimeout(resolve, 5))
    queue.cancel()

    expect(receivedSignal?.aborted).toBe(true)
  })
})

describe('UploadQueue 보내는 파일 이름', () => {
  // 줄이면 확장자가 .jpg로 바뀌는 실제 준비 단계를 흉내 낸다
  const prepareAsJpeg = async (file: File) =>
    new File([file], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' })

  it('줄인 뒤 이름이 겹치면 뒤 사진 이름을 바꿔 보내고, 서버가 하나만 거절하면 그 사진만 실패', async () => {
    const sentNames: string[] = []
    const queue = createTestQueue({
      prepareFile: prepareAsJpeg,
      uploadBatch: async (files) => {
        sentNames.push(...files.map((file) => file.name))
        return { uploaded: 1, failed: [{ fileName: 'a (2).jpg', reason: 'UNSUPPORTED_FILE' }] }
      },
    })

    // 폴더째 올리면 이름이 같은 사진, 줄이면 이름이 같아지는 사진(a.png → a.jpg)이 함께 들어온다
    queue.add([
      new File(['1'], 'a.jpg', { type: 'image/jpeg', lastModified: 1 }),
      new File(['22'], 'a.png', { type: 'image/png', lastModified: 2 }),
    ])
    await queue.waitUntilIdle()

    expect(sentNames).toEqual(['a.jpg', 'a (2).jpg'])
    expect(queue.getSnapshot().items.map((item) => [item.fileName, item.status])).toEqual([
      ['a.jpg', 'done'],
      ['a.png', 'failed'],
    ])
  })

  it('다른 묶음에서도 이미 쓴 이름은 쓰지 않는다', async () => {
    const sentNames: string[] = []
    const queue = createTestQueue({
      prepareFile: prepareAsJpeg,
      uploadBatch: async (files) => {
        sentNames.push(...files.map((file) => file.name))
        return succeedAll(files)
      },
    })

    queue.add([new File(['1'], 'IMG_0001.jpg', { type: 'image/jpeg', lastModified: 1 })])
    await queue.waitUntilIdle()
    queue.add([new File(['22'], 'IMG_0001.jpg', { type: 'image/jpeg', lastModified: 2 })])
    await queue.waitUntilIdle()

    expect(sentNames).toEqual(['IMG_0001.jpg', 'IMG_0001 (2).jpg'])
  })

  it('다시 보낼 때는 처음 줄인 파일을 그대로 쓴다(다시 줄이지 않음)', async () => {
    const prepareFile = vi.fn(prepareAsJpeg)
    const sentNames: string[][] = []
    let callCount = 0
    const queue = createTestQueue({
      prepareFile,
      uploadBatch: async (files) => {
        callCount += 1
        sentNames.push(files.map((file) => file.name))
        if (callCount === 1)
          throw new ApiError({ code: 'NETWORK_ERROR', status: null, serverMessage: null })
        return succeedAll(files)
      },
    })

    queue.add(createFiles(2))
    await queue.waitUntilIdle()

    expect(prepareFile).toHaveBeenCalledTimes(2)
    expect(sentNames).toEqual([
      ['IMG_1.jpg', 'IMG_2.jpg'],
      ['IMG_1.jpg', 'IMG_2.jpg'],
    ])
    expect(queue.getSnapshot()).toMatchObject({ doneCount: 2, failedCount: 0 })
  })
})
