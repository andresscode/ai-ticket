import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (!env.BFF_URL) {
    throw new Error('BFF_URL not set')
  }

  const target = env.BFF_URL

  return {
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/auth': { target, changeOrigin: false },
        '/api': { target, changeOrigin: false },
      },
    },
    preview: {
      port: 3000,
      proxy: {
        '/auth': { target, changeOrigin: false },
        '/api': { target, changeOrigin: false },
      },
    },
  }
})
