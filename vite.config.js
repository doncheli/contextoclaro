import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Plugin: convert CSS link → preload + async stylesheet pattern
// Reduce el render-blocking en mobile (FCP/LCP win).
function asyncCssPlugin() {
  return {
    name: 'async-css-after-build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // Encontrar el <link rel="stylesheet" ... href="/assets/index-XXX.css">
        return html.replace(
          /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
          (_match, href) => {
            // Doble link: preload + async stylesheet
            return `<link rel="preload" as="style" fetchpriority="high" href="${href}">
    <link rel="stylesheet" href="${href}" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="${href}"></noscript>`
          },
        )
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), asyncCssPlugin()],
  build: {
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
    minify: 'esbuild',
    target: 'es2020',
    cssCodeSplit: true,
    reportCompressedSize: false,
  },
  esbuild: {
    drop: ['debugger'],
    pure: ['console.debug', 'console.trace'],
  },
})
