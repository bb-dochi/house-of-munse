import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

// cloudflare 플러그인이 개발 서버 안에서 Worker(/api)와 로컬 D1을 함께 띄웁니다.
export default defineConfig({
  plugins: [react(), cloudflare()],
});
