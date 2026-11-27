import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // React, the router and the Supabase client are needed on every page, so the main
    // bundle is naturally about 540 kB (about 160 kB over the wire). Pages load on demand.
    chunkSizeWarningLimit: 600,
  },
})
