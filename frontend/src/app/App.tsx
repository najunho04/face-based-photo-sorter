import { env } from '@/shared/config/env'

// 0단계 자리 표시 화면. 3단계에서 라우터로 바뀐다.
export default function App() {
  return (
    <main style={{ padding: 24 }}>
      <h1>인생내컷</h1>
      <p>프론트엔드 준비 중 · 가짜 API {env.useMock ? '사용' : '사용 안 함'}</p>
    </main>
  )
}
