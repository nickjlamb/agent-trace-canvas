import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy the WebSocket replay endpoint to the local node server (npm run dev:server).
    proxy: {
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
})
