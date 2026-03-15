import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ToListNow',
        short_name: 'ToListNow',
        description: 'Listas de cuentas por pagar, cuentas por cobrar y gastos fijos. Crea listas, invita a otros y lleva el control en dólares.',
        theme_color: '#0d9488',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'es',
        categories: ['finance', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [{ urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i, handler: 'CacheFirst', options: { cacheName: 'firebase', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 } } }],
      },
      devOptions: { enabled: true },
    }),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
})
