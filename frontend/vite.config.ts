/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { msw } from 'msw/vite'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // .env 파일의 값(VITE_API_PROXY_TARGET)을 설정 파일에서도 읽는다
  const fileEnvironment = loadEnv(mode, import.meta.dirname)
  return {
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
      // 실제 백엔드로 개발할 때 /api 요청을 로컬 백엔드로 넘긴다(9단계 결정).
      // 화면과 같은 주소로 요청하므로 백엔드가 CORS를 열 필요가 없다. 가짜 API를 켜면 서비스 워커가 먼저 받는다
      proxy: {
        '/api': {
          target: fileEnvironment.VITE_API_PROXY_TARGET || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
    test: {
      // 로직 테스트만 돌린다(TDD 대상). sessionStorage·location이 필요해 가벼운 브라우저 흉내(happy-dom)를 쓴다
      environment: 'happy-dom',
      environmentOptions: { happyDOM: { url: 'http://localhost:5173' } },
      include: ['src/**/*.test.ts'],
      restoreMocks: true,
    },
  }
})
