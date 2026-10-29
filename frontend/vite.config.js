
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/location': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/location/, ''),
      },
      '/api/rides': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => {
          if (path === '/api/rides/health') return '/health'
          return path.replace(/^\/api\/rides/, '/rides')
        },
      },
      '/api/matches': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (path) => {
          if (path === '/api/matches/health') return '/health'
          return path.replace(/^\/api\/matches/, '/matches')
        },
      },
    },
  },
})
