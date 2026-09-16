import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The app is served from https://lukesdyer01.github.io/porta/, so every asset
// URL needs that prefix. A custom domain later would change this to '/'.
export default defineConfig({
  base: '/porta/',
  plugins: [react(), tailwindcss()],
})
