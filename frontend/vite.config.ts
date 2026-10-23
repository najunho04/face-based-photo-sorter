/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { msw } from 'msw/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // msw(): 개발 서버에서 가짜 API용 서비스 워커 파일을 내려준다.
  // 빌드에서는 'virtual:msw'를 불러오는 코드가 남아 있을 때만 파일을 넣는다(실제 API 빌드에는 없음)
  plugins: [react(), tailwindcss(), msw()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // 실제 휴대폰 확인용 Cloudflare 임시 터널 주소(https)로 들어오는 요청을 허용한다(개발 서버에만 적용, 결정 기록 5단계)
    allowedHosts: ['.trycloudflare.com'],
  },
  test: {
    // 로직 테스트만 돌린다(TDD 대상). sessionStorage·location이 필요해 가벼운 브라우저 흉내(happy-dom)를 쓴다
    environment: 'happy-dom',
    environmentOptions: { happyDOM: { url: 'http://localhost:5173' } },
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
})
