import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Desativa processamento CSS se necessário
    css: {
      postcss: null
    }
  }
})
