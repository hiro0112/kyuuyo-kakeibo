import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // GitHub Pages のサブフォルダ（/kyuuyo-kakeibo/）でも動くよう、相対パスで出力する
    base: './',
    plugins: [react()],
    server: {
      // /api へのリクエストはバックエンド（Node.js）に転送する
      proxy: {
        '/api': `http://127.0.0.1:${env.PORT || 3001}`,
      },
    },
  };
});
