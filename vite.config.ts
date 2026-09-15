import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path for GitHub Pages project site (repo name). Change if the repo
  // is renamed, or set to '/' for a user/org site.
  base: '/QuantumChess/',
})