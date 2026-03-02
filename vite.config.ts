import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Use './' for Electron (relative paths). Set VITE_BASE_URL for web deployments (e.g. '/texel/' for GitHub Pages).
  base: process.env.VITE_BASE_URL ?? './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
