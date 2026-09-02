import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // PWA: manifest + service worker → instalable en Android/iPhone y offline
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.jpg'],
      manifest: {
        name: 'Colombia Navega',
        short_name: 'Colombia Navega',
        description:
          'Control de flota náutica — reportes de capitanes, mapa en tiempo real y exportación a Excel.',
        lang: 'es',
        theme_color: '#f6f3ea',
        background_color: '#f6f3ea',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,webmanifest}'],
        // La app es de datos en tiempo real: no cachear respuestas de red de API
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  // Rutas relativas: funciona en GitHub Pages (djangelek.github.io/app/ o en la raíz)
  base: './',
  server: {
    host: true,
    port: 5173,
    // El repo vive en OneDrive: fs.watch da EBUSY cuando OneDrive bloquea
    // archivos al sincronizarlos (crash de Vite). Polling lo evita.
    // También ignoramos supabase/ (el CLI crea temporales .tmpdir).
    watch: { usePolling: true, ignored: ['**/supabase/**', '**/node_modules/**'] },
  },
  build: {
    rollupOptions: {
      output: {
        // Separar vendors para mejor caché y carga
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          excel: ['exceljs'],
        },
      },
    },
  },
});
