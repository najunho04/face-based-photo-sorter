// 동시에 실행하는 작업 수를 제한한다. 넘치는 작업은 줄을 세웠다가 앞의 작업이 끝나면(실패해도) 순서대로 시작한다.
// 대표 얼굴처럼 큰 사진 여러 장을 한꺼번에 펼치면 휴대폰 메모리가 순간적으로 크게 늘어서 쓴다
export function createConcurrencyLimiter(maximumConcurrency: number) {
  let runningCount = 0
  const waitingStarts: Array<() => void> = []

  // 자리가 나면 기다리던 작업 하나를 시작한다
  function startNextWaiting() {
    if (runningCount >= maximumConcurrency) return
    const startNext = waitingStarts.shift()
    startNext?.()
  }

  return {
    /** 자리가 나면 task를 실행하고 그 결과를 돌려준다 */
    run<Result>(task: () => Promise<Result>): Promise<Result> {
      return new Promise<Result>((resolve, reject) => {
        waitingStarts.push(() => {
          runningCount += 1
          // task가 곧바로 예외를 던져도 자리를 비우도록 Promise로 감싸서 실행한다
          Promise.resolve()
            .then(task)
            .then(resolve, reject)
            .finally(() => {
              runningCount -= 1
              startNextWaiting()
            })
        })
        startNextWaiting()
      })
    },
  }
}
