import { mockHandlers } from '@/mocks/handlers'

// 개발 서버에서 가짜 API를 켠다. main.tsx가 화면을 그리기 전에 기다려서 첫 요청부터 가짜 API가 받게 한다.
export async function startMockApi(): Promise<void> {
  // msw/vite 플러그인이 만든 모듈. 서비스 워커 등록과 핸들러 연결을 맡는다
  const { network } = await import('virtual:msw')
  network.configure({
    handlers: mockHandlers,
    // 핸들러가 없는 /api 요청만 경고하고, 나머지(화면 파일·글꼴 등)는 그대로 통과시킨다
    onUnhandledFrame({ frame, defaults }) {
      const request = (frame.data as { request?: Request }).request
      if (request && new URL(request.url).pathname.startsWith('/api/')) defaults.warn()
    },
  })
  await network.enable()
}
