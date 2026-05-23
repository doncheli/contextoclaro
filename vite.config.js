import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Reduce chunk warning threshold but split heavy vendors
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') && !id.includes('react-')) return 'vendor-react'
            if (id.includes('react-dom')) return 'vendor-react'
            if (id.includes('@supabase')) return 'vendor-supabase'
            if (id.includes('lucide-react')) return 'vendor-icons'
            if (id.includes('@hyvor')) return 'vendor-comments'
            return 'vendor'
          }
        },
      },
    },
    // Drop unused code
    minify: 'esbuild',
    target: 'es2020',
  },
  esbuild: {
    drop: ['debugger'],
    pure: ['console.debug', 'console.trace'],
  },
})
