import { ApiError } from '@/shared/api/api-error'

// 관리자 사진 업로드 대기열(화면과 상관없는 순수 TS, 테스트 먼저). 결정 기록 7단계:
// 사진을 줄여(준비) 요청당 4장씩, 동시에 2요청까지 보내고, 네트워크·서버 오류만 3번까지 다시 보낸다.

export type UploadItemStatus = 'waiting' | 'preparing' | 'uploading' | 'done' | 'failed'

export type UploadItem = {
  id: string
  fileName: string
  status: UploadItemStatus
  /** 실패 이유 코드(UNSUPPORTED_FILE, NETWORK_ERROR 등). 화면 문구는 화면이 정한다 */
  failureReason: string | null
  /** 보낸 횟수(다시 시도 포함) */
  attemptCount: number
}

export type UploadSnapshot = {
  items: UploadItem[]
  totalCount: number
  doneCount: number
  failedCount: number
  /** 기다리거나 준비·보내는 중인 장 수 */
  remainingCount: number
  isIdle: boolean
}

/** #3 업로드 응답과 같은 모양 */
export type UploadBatchResult = {
  uploaded: number
  failed: Array<{ fileName: string; reason: string }>
}

/** 사진 줄이기(준비) 단계의 실패. reason은 화면 문구를 고를 코드 */
export class UploadPreparationError extends Error {
  readonly reason: string
  constructor(reason: string) {
    super(`사진을 준비하지 못했어요: ${reason}`)
    this.name = 'UploadPreparationError'
    this.reason = reason
  }
}

type UploadQueueOptions = {
  /** 보내기 전에 사진을 줄인다(2000px JPG). 실패하면 UploadPreparationError를 던진다 */
  prepareFile: (file: File) => Promise<File>
  /** 여러 장을 한 번에 보낸다(#3) */
  uploadBatch: (files: File[], signal: AbortSignal) => Promise<UploadBatchResult>
  onChange?: (snapshot: UploadSnapshot) => void
  batchSize?: number
  concurrency?: number
  maxAttemptCount?: number
  /** 다시 보내기 전에 기다리는 시간(몇 번째 시도인지에 따라 늘림) */
  retryDelayMilliseconds?: (attemptCount: number) => number
}

/** 다시 보내면 나아질 수 있는 오류(네트워크 끊김·시간 초과·서버 오류) */
const retryableErrorCodes = new Set(['NETWORK_ERROR', 'TIMEOUT', 'INTERNAL_ERROR'])

type QueueEntry = UploadItem & { file: File; duplicateKey: string }

// 같은 파일인지 알아보는 열쇠(이름·크기·수정 시각)
function createDuplicateKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

export function createUploadQueue({
  prepareFile,
  uploadBatch,
  onChange,
  batchSize = 4,
  concurrency = 2,
  maxAttemptCount = 3,
  retryDelayMilliseconds = (attemptCount) => 1000 * attemptCount,
}: UploadQueueOptions) {
  const entries: QueueEntry[] = []
  let activeBatchCount = 0
  let pendingRetryCount = 0
  let nextItemNumber = 1
  let abortController = new AbortController()
  let idleWaiters: Array<() => void> = []

  function getSnapshot(): UploadSnapshot {
    const items = entries.map((entry) => ({
      id: entry.id,
      fileName: entry.fileName,
      status: entry.status,
      failureReason: entry.failureReason,
      attemptCount: entry.attemptCount,
    }))
    const doneCount = items.filter((item) => item.status === 'done').length
    const failedCount = items.filter((item) => item.status === 'failed').length
    const remainingCount = items.length - doneCount - failedCount
    return {
      items,
      totalCount: items.length,
      doneCount,
      failedCount,
      remainingCount,
      isIdle: remainingCount === 0 && activeBatchCount === 0 && pendingRetryCount === 0,
    }
  }

  // 바뀐 상태를 알리고, 일이 모두 끝났으면 기다리는 쪽을 깨운다
  function notifyChange() {
    const snapshot = getSnapshot()
    onChange?.(snapshot)
    if (snapshot.isIdle) {
      const waiters = idleWaiters
      idleWaiters = []
      waiters.forEach((resolve) => resolve())
    }
  }

  function markFailed(batchEntries: QueueEntry[], reason: string) {
    for (const entry of batchEntries) {
      entry.status = 'failed'
      entry.failureReason = reason
    }
  }

  // 기다리는 사진이 있고 동시 요청 수가 남았으면 다음 묶음을 시작한다
  function pump() {
    while (activeBatchCount < concurrency) {
      const batchEntries = entries.filter((entry) => entry.status === 'waiting').slice(0, batchSize)
      if (batchEntries.length === 0) break
      batchEntries.forEach((entry) => (entry.status = 'preparing'))
      activeBatchCount += 1
      void runBatch(batchEntries).finally(() => {
        activeBatchCount -= 1
        pump()
        notifyChange()
      })
    }
    notifyChange()
  }

  // 묶음 하나: 차례로 줄이고(동시에 줄이는 장 수 = 동시 요청 수), 준비된 사진을 한 번에 보낸다
  async function runBatch(batchEntries: QueueEntry[]) {
    const signal = abortController.signal
    const preparedFiles: Array<{ entry: QueueEntry; file: File }> = []
    for (const entry of batchEntries) {
      if (signal.aborted) return
      try {
        preparedFiles.push({ entry, file: await prepareFile(entry.file) })
      } catch (error) {
        markFailed(
          [entry],
          error instanceof UploadPreparationError ? error.reason : 'UNSUPPORTED_FILE',
        )
        notifyChange()
      }
    }
    if (preparedFiles.length === 0 || signal.aborted) return

    const sendingEntries = preparedFiles.map(({ entry }) => entry)
    sendingEntries.forEach((entry) => {
      entry.status = 'uploading'
      entry.attemptCount += 1
    })
    notifyChange()

    try {
      const result = await uploadBatch(
        preparedFiles.map(({ file }) => file),
        signal,
      )
      // 서버가 거절한 파일만 실패로, 나머지는 완료
      preparedFiles.forEach(({ entry, file }) => {
        const rejection = result.failed.find((failure) => failure.fileName === file.name)
        entry.status = rejection ? 'failed' : 'done'
        entry.failureReason = rejection ? rejection.reason : null
      })
    } catch (error) {
      if (signal.aborted) return
      const errorCode = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR'
      const canRetry =
        retryableErrorCodes.has(errorCode) &&
        sendingEntries.every((entry) => entry.attemptCount < maxAttemptCount)
      if (!canRetry) {
        markFailed(sendingEntries, errorCode)
        return
      }
      // 잠시 기다렸다가 같은 사진들을 다시 대기열에 넣는다
      sendingEntries.forEach((entry) => (entry.status = 'preparing'))
      pendingRetryCount += 1
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelayMilliseconds(sendingEntries[0].attemptCount)),
      )
      pendingRetryCount -= 1
      if (!signal.aborted) sendingEntries.forEach((entry) => (entry.status = 'waiting'))
    }
  }

  return {
    /** 사진을 더한다. 이미 넣은 같은 파일은 빼고, 새로 넣은 장 수를 돌려준다 */
    add(files: File[]): number {
      let addedCount = 0
      for (const file of files) {
        const duplicateKey = createDuplicateKey(file)
        if (entries.some((entry) => entry.duplicateKey === duplicateKey)) continue
        entries.push({
          id: `upload-${nextItemNumber++}`,
          fileName: file.name,
          status: 'waiting',
          failureReason: null,
          attemptCount: 0,
          file,
          duplicateKey,
        })
        addedCount += 1
      }
      pump()
      return addedCount
    },
    /** 실패한 사진을 다시 보낸다(줄이기 실패·형식 오류도 다시 시도) */
    retryFailed() {
      entries
        .filter((entry) => entry.status === 'failed')
        .forEach((entry) => {
          entry.status = 'waiting'
          entry.failureReason = null
          entry.attemptCount = 0
        })
      pump()
    },
    /** 보내는 중인 요청을 멈추고, 아직 안 보낸 사진은 대기열에서 뺀다(화면을 떠날 때) */
    cancel() {
      abortController.abort()
      abortController = new AbortController()
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        if (entries[index].status !== 'done' && entries[index].status !== 'failed') {
          entries.splice(index, 1)
        }
      }
      notifyChange()
    },
    getSnapshot,
    /** 모든 일이 끝날 때까지 기다린다(테스트·완료 확인용) */
    waitUntilIdle(): Promise<void> {
      if (getSnapshot().isIdle) return Promise.resolve()
      return new Promise((resolve) => idleWaiters.push(resolve))
    },
  }
}

export type UploadQueue = ReturnType<typeof createUploadQueue>
