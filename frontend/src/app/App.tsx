import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { RouterProvider } from 'react-router/dom'
import { router } from '@/app/router'
import { connectUnauthorizedRedirect } from '@/app/unauthorized-redirect'
import { createQueryClient } from '@/shared/api/query-client'
import { Toaster } from '@/shared/ui/sonner'

// 앱 전체에서 하나만 쓰는 서버 데이터 캐시
const queryClient = createQueryClient()

// 앱의 맨 바깥: 서버 데이터 캐시, 화면 주소표, 알림 표시 자리를 연결한다
export default function App() {
  // API가 401을 받으면 참가자는 ⑧, 관리자는 A1로 보내도록 연결한다
  useEffect(() => connectUnauthorizedRedirect({ router, queryClient }), [])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  )
}
