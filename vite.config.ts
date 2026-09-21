import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  build: {
    rollupOptions: {
      input: {
        // Both entries boot the exact same React app (src/main.tsx) — this is only
        // about which static <head> a host's raw HTML request gets before JS runs.
        // See vercel.json's host-matched rewrite for splitsubs.cortdevs.com.
        main: path.resolve(__dirname, 'index.html'),
        splitsubs: path.resolve(__dirname, 'splitsubs.html'),
      },
    },
  },
})
