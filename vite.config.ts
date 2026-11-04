import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

// GitHub Pages serves unknown paths with 404.html; a copy of index.html lets the SPA router take over.
const spaFallback = (): Plugin => ({
  name: 'spa-fallback',
  apply: 'build',
  closeBundle() {
    const out = resolve(process.cwd(), 'dist')
    copyFileSync(resolve(out, 'index.html'), resolve(out, '404.html'))
  },
})

export default defineConfig({
  // BASE_PATH is set by the Pages workflow to "/<repo>/"; local dev uses "/".
  base: process.env.BASE_PATH || '/',
  plugins: [react(), spaFallback()],
  build: { chunkSizeWarningLimit: 1200 },
})
