import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The app is served from https://lukesdyer01.github.io/porta/, so every asset
// URL needs that prefix. A custom domain later would change this to '/'.
export default defineConfig({
  // Stamped at build time so the More sheet can show which build is running —
  // the difference between "I refreshed" and "the refresh actually worked".
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  base: '/porta/',
  plugins: [react(), tailwindcss()],
})
