import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub repository name for GitHub Pages:
// https://shaynedigo31-cyber.github.io/leadlink/
export default defineConfig({
  base: '/leadlink/',
  plugins: [react()],
})
