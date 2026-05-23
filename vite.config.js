import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // React core: react + react-dom + scheduler
            if (id.includes('react-dom') || id.includes('scheduler')) return 'vendor-react'
            if (/\/react\/[^/]+$/.test(id) || id.includes('react/jsx-runtime')) return 'vendor-react'
            // Supabase client: separar realtime que es pesado y solo se necesita en componentes específicos
            if (id.includes('@supabase/realtime-js')) return 'vendor-realtime'
            if (id.includes('@supabase')) return 'vendor-supabase'
            // Lucide icons: chunk separado (a veces es grande)
            if (id.includes('lucide-react')) return 'vendor-icons'
            // Otros 3rd parties pequeños
            if (id.includes('@hyvor')) return 'vendor-comments'
            return 'vendor'
          }
          // App splits internos: components grandes en chunks separados
          if (id.includes('/components/BlindspotLATAM')) return 'chunk-blindspot'
          if (id.includes('/components/PoliticalFeedCarousel')) return 'chunk-political'
          if (id.includes('/components/Comments')) return 'chunk-comments'
          if (id.includes('/components/AccessibilityWidget')) return 'chunk-a11y'
        },
      },
    },
    minify: 'esbuild',
    target: 'es2020',
    cssCodeSplit: true,
    reportCompressedSize: false,
    // CSS code split + asset inline más agresivo (assets <8KB se inlinean como base64)
    assetsInlineLimit: 8192,
    // Pre-compress: brotli es mejor que gzip, pero Vercel ya lo hace automático.
    // Modulpreload: precarga chunks críticos
    modulePreload: { polyfill: false },
  },
  esbuild: {
    drop: ['debugger'],
    pure: ['console.debug', 'console.trace', 'console.log'],
    // Tree shake más agresivo para production
    treeShaking: true,
    legalComments: 'none',
  },
})
