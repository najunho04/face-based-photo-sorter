import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/shared/api/api-error'

// 다시 시도하면 나아질 수 있는 오류. 나머지(권한·없음·상태 오류)는 몇 번을 보내도 같으므로 바로 보여 준다
const retryableErrorCodes = new Set(['NETWORK_ERROR', 'TIMEOUT', 'INTERNAL_ERROR'])

/** TanStack Query의 retry 판단. failureCount는 지금까지 실패한 횟수(첫 실패 뒤에는 0) */
export function shouldRetryRequest(failureCount: number, error: unknown): boolean {
  return error instanceof ApiError && retryableErrorCodes.has(error.code) && failureCount < 1
}

// 앱 전체에서 쓰는 서버 데이터 캐시. 3단계에서 Provider로 연결한다
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryRequest,
        // 탭을 다시 볼 때마다 사진 목록을 새로 받으면 격자가 깜빡여서 끈다. 필요한 화면만 주기적으로 다시 받는다
        refetchOnWindowFocus: false,
        // 30초 안에는 같은 목록을 다시 요청하지 않는다(화면 이동이 잦은 참가자 흐름)
        staleTime: 30_000,
      },
      mutations: {
        // 업로드·로그인·셀카 검색은 자동으로 다시 보내지 않는다(중복 업로드 방지, 재시도는 업로드 대기열이 직접 함)
        retry: false,
      },
    },
  })
}
