import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@/shared/styles/index.css'
import App from '@/app/App'
import { environment } from '@/shared/config/environment'

// 오류 재현 패널은 가짜 API를 켠 개발 서버에서만 불러온다.
// import.meta.env.DEV를 맨 앞에 두어야 빌드에서 이 코드와 가짜 API 전체가 빠진다
const MockDevelopmentPanel =
  import.meta.env.DEV && environment.useMock
    ? lazy(() => import('@/mocks/development-panel/mock-development-panel'))
    : null

// 가짜 API를 켜야 하면 서비스 워커가 준비될 때까지 기다린 뒤 화면을 그린다
async function prepareMockApi(): Promise<void> {
  if (import.meta.env.DEV && environment.useMock) {
    const { startMockApi } = await import('@/mocks/start-mock-api')
    await startMockApi()
  }
}

void prepareMockApi().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      {MockDevelopmentPanel && (
        <Suspense fallback={null}>
          <MockDevelopmentPanel />
        </Suspense>
      )}
    </StrictMode>,
  )
})
