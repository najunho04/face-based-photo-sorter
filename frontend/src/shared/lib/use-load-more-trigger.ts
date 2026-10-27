import { useCallback, useEffect, useRef } from 'react'

// 무한 스크롤: 목록 끝에 둔 표시 요소가 화면 가까이(600px 전) 오면 다음 페이지를 부른다.
// 돌려받은 ref를 목록 끝 요소에 붙인다. enabled가 false면(다음 페이지 없음·불러오는 중) 부르지 않는다
export function useLoadMoreTrigger(onLoadMore: () => void, enabled: boolean) {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  const enabledRef = useRef(enabled)

  // 관찰자를 다시 만들지 않고 최신 함수·상태를 쓰도록 ref에 담아 둔다
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
    enabledRef.current = enabled
  })

  return useCallback((element: HTMLElement | null) => {
    observerRef.current?.disconnect()
    if (!element) return
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && enabledRef.current) {
          onLoadMoreRef.current()
        }
      },
      { rootMargin: '600px 0px' },
    )
    observerRef.current.observe(element)
  }, [])
}
