import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, process.cwd(), 'VITE_'),
    ...loadEnv(mode, process.cwd(), 'BACKEND_'),
    ...loadEnv(mode, process.cwd(), 'FRONTEND_'),
  }
  const backendPort = env.BACKEND_PORT || process.env.BACKEND_PORT || process.env.PORT || '4000'
  const frontendPort = Number(env.FRONTEND_PORT || process.env.FRONTEND_PORT || env.VITE_PORT || process.env.VITE_PORT || 5174)
  const apiTarget = (env.VITE_API_URL || '').trim() || `http://localhost:${backendPort}`

  return {
    plugins: [react()],
    server: {
      port: frontendPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
