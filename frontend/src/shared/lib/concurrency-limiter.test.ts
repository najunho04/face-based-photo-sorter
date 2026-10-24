import { describe, expect, it } from 'vitest'
import { createConcurrencyLimiter } from '@/shared/lib/concurrency-limiter'

// 밖에서 끝낼 수 있는 작업(언제 끝날지 테스트가 정한다)
function createControllableTask() {
  let finish: () => void = () => {}
  let fail: (error: Error) => void = () => {}
  const promise = new Promise<void>((resolve, reject) => {
    finish = resolve
    fail = reject
  })
  return { run: () => promise, finish, fail }
}

// 기다리던 작업이 시작될 틈을 준다
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createConcurrencyLimiter (동시에 실행하는 작업 수 제한)', () => {
  it('정해진 수까지만 동시에 실행하고, 하나가 끝나면 기다리던 작업을 순서대로 시작한다', async () => {
    const limiter = createConcurrencyLimiter(2)
    const startedTaskNumbers: number[] = []
    const tasks = [1, 2, 3, 4].map(() => createControllableTask())

    tasks.forEach(
      (task, index) =>
        void limiter.run(() => {
          startedTaskNumbers.push(index + 1)
          return task.run()
        }),
    )
    await flushMicrotasks()
    expect(startedTaskNumbers).toEqual([1, 2])

    tasks[0].finish()
    await flushMicrotasks()
    expect(startedTaskNumbers).toEqual([1, 2, 3])

    tasks[1].finish()
    tasks[2].finish()
    await flushMicrotasks()
    expect(startedTaskNumbers).toEqual([1, 2, 3, 4])
  })

  it('실패한 작업도 자리를 비워 다음 작업이 시작된다', async () => {
    const limiter = createConcurrencyLimiter(1)
    const failingTask = createControllableTask()
    let hasSecondStarted = false

    const firstResult = limiter.run(failingTask.run)
    void limiter.run(async () => {
      hasSecondStarted = true
    })
    failingTask.fail(new Error('이미지를 불러오지 못함'))

    await expect(firstResult).rejects.toThrow('이미지를 불러오지 못함')
    await flushMicrotasks()
    expect(hasSecondStarted).toBe(true)
  })

  it('작업의 결과를 그대로 돌려준다', async () => {
    const limiter = createConcurrencyLimiter(4)

    await expect(limiter.run(async () => 'drawn')).resolves.toBe('drawn')
  })
})
