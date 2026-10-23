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
