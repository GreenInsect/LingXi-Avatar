import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://106.54.18.117:5000',
        changeOrigin: true,
        proxyTimeout: 120_000,
        timeout: 120_000,
        configure: proxy => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.info('[vite proxy] request', req.method, req.url, '->', proxyReq.protocol + '//' + proxyReq.host + proxyReq.path)
          })
          proxy.on('proxyRes', (proxyRes, req) => {
            console.info('[vite proxy] response', req.method, req.url, proxyRes.statusCode)
          })
          proxy.on('error', (err, req) => {
            console.error('[vite proxy] error', req.method, req.url, err.code, err.message)
          })
        },
      }
    }
  }
})
