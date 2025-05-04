import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, ConfigEnv } from 'vite'

export default ({ mode }: ConfigEnv) => {
  // load all env vars (unprefixed) from .env.<mode>
  const env = loadEnv(mode, process.cwd(), '')

  return defineConfig({
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL),
    },
  })
}