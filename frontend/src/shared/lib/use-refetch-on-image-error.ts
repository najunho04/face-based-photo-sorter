import { useCallback, useRef } from 'react'

/** 사진 여러 장이 한꺼번에 깨져도 목록은 이 간격에 한 번만 다시 받는다 */
const minimumRefetchIntervalMilliseconds = 15_000

// 사진이 깨졌을 때(주소 만료 403 등) 목록을 다시 받아 새 주소로 바꾸는 함수를 돌려준다.
// 격자의 사진이 동시에 수십 장 깨질 수 있으므로 짧은 시간 안의 중복 요청은 막는다
export function useRefetchOnImageError(refetch: () => unknown): () => void {
  const lastRefetchAtRef = useRef(0)
  return useCallback(() => {
    const now = Date.now()
    if (now - lastRefetchAtRef.current < minimumRefetchIntervalMilliseconds) return
    lastRefetchAtRef.current = now
    refetch()
  }, [refetch])
}
