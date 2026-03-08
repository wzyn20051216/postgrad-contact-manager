import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  plugins: [
    vue(),
    UnoCSS(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          'naive-ui': ['naive-ui'],
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
        },
      },
    },
  },
})
