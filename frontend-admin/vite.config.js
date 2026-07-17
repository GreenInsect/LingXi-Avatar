import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function getEnv(env, name, fallback) {
  return env[name] || process.env[name] || fallback
}

function formatProxyTarget(proxyReq) {
  return `${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const ADMIN_HOST = getEnv(env, 'VITE_ADMIN_HOST', '0.0.0.0')
  const ADMIN_PORT = Number(getEnv(env, 'VITE_ADMIN_PORT', '4000'))
  const BACKEND_TARGET = getEnv(env, 'VITE_ADMIN_BACKEND_URL', 'http://localhost:5000')
  const PROXY_TIMEOUT = Number(getEnv(env, 'VITE_ADMIN_PROXY_TIMEOUT_MS', '120000'))

  console.info('[admin-vite] config', {
    mode,
    host: ADMIN_HOST,
    port: ADMIN_PORT,
    backendTarget: BACKEND_TARGET,
    proxyTimeoutMs: PROXY_TIMEOUT,
  })

  return {
    plugins: [react()],
    server: {
      host: ADMIN_HOST,
      port: ADMIN_PORT,
      strictPort: true,
      allowedHosts: true,
      cors: true,
      proxy: {
        '/api': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          secure: false,
          ws: true,
          proxyTimeout: PROXY_TIMEOUT,
          timeout: PROXY_TIMEOUT,
          configure: proxy => {
            proxy.on('proxyReq', (proxyReq, req) => {
              console.info('[admin-vite proxy] request', {
                method: req.method,
                url: req.url,
                target: formatProxyTarget(proxyReq),
                requestId: req.headers['x-request-id'] || '-',
              })
            })
            proxy.on('proxyRes', (proxyRes, req) => {
              console.info('[admin-vite proxy] response', {
                method: req.method,
                url: req.url,
                status: proxyRes.statusCode,
                requestId: req.headers['x-request-id'] || proxyRes.headers['x-request-id'] || '-',
              })
            })
            proxy.on('error', (err, req) => {
              console.error('[admin-vite proxy] error', {
                method: req?.method,
                url: req?.url,
                code: err.code,
                message: err.message,
                requestId: req?.headers?.['x-request-id'] || '-',
              })
            })
          },
        },
      },
    },
    preview: {
      host: ADMIN_HOST,
      port: ADMIN_PORT,
      strictPort: true,
      allowedHosts: true,
    },
  }
})
