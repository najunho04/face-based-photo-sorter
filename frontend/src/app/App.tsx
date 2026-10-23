import { env } from '@/shared/config/env'

// 자리 표시 화면. 3단계에서 라우터로 바뀐다.
export default function App() {
  return (
    <main className="mx-auto flex max-w-content flex-col gap-2 p-6">
      <h1 className="text-title-1 text-primary">인생내컷</h1>
      <p className="text-body text-muted-foreground">
        프론트엔드 준비 중 · 가짜 API {env.useMock ? '사용' : '사용 안 함'}
      </p>
    </main>
  )
}
