import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages 部署在子路径 /jw-project-hub/ 下；workbuddy.host 为根路径。
  // 通过 VITE_BASE 区分，两者共用同一份源码。
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
    allowedHosts: true,
    hmr: false,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
