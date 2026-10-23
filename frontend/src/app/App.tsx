import { lazy, Suspense } from 'react'
import { environment } from '@/shared/config/environment'

// 컴포넌트 모음은 개발 서버에서만 불러온다. 빌드에서는 import.meta.env.DEV가 false라 코드가 빠진다
const UiGalleryPage = import.meta.env.DEV ? lazy(() => import('@/pages/dev/ui-gallery-page')) : null

// 자리 표시 화면. 3단계에서 라우터로 바뀐다.
export default function App() {
  // 라우터가 생기기 전까지 /dev/ui 주소만 직접 확인해 컴포넌트 모음을 보여 준다
  if (UiGalleryPage && window.location.pathname === '/dev/ui') {
    return (
      <Suspense fallback={null}>
        <UiGalleryPage />
      </Suspense>
    )
  }

  return (
    <main className="mx-auto flex max-w-content flex-col gap-2 p-6">
      <h1 className="text-title-1 text-primary">인생내컷</h1>
      <p className="text-body text-muted-foreground">
        프론트엔드 준비 중 · 가짜 API {environment.useMock ? '사용' : '사용 안 함'}
      </p>
    </main>
  )
}
