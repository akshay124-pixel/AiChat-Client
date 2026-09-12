import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load .env so VITE_API_BASE_URL is available during dev-server proxy setup
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_BASE_URL || 'http://localhost:8000'

  return {
    plugins: [react()],

    // Dev server — proxy /api → backend so you don't need CORS locally
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          // SSE requires disabling response buffering
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              // Keep SSE connections alive through the dev proxy
              proxyRes.headers['cache-control'] = 'no-cache'
            })
          },
        },
      },
    },

    // Preview server (npm run preview)
    preview: {
      port: 4173,
    },

    // Path alias
    resolve: {
      alias: {
        '@': '/src',
      },
    },

    build: {
      // Raise the warning threshold — our bundle is fine at ~500 KB
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Split heavy deps into separate chunks for better caching
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'markdown-vendor': ['react-markdown', 'remark-gfm', 'rehype-highlight', 'highlight.js'],
            'ui-vendor': ['lucide-react', 'clsx', 'date-fns'],
          },
        },
      },
    },
  }
})
