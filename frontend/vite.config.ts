import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Backend port for dev proxy (set by root `npm run dev` via scripts/dev.cjs). */
const apiPort = process.env.API_PORT || '4000';
const apiTarget = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      /** Do not register a service worker during `vite dev` (avoids confusing stale caches). */
      devOptions: { enabled: false },
      includeAssets: ['logo.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'The Pigsty',
        short_name: 'Pigsty',
        description: 'Smart Farm Management Platform',
        theme_color: '#143109',
        background_color: '#f7f7f7',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    /** Keeps dev URL stable so repo-root `open-app.html` matches; free 5173 or stop the other process. */
    strictPort: true,
    /**
     * Bind IPv4 loopback explicitly so http://127.0.0.1:5173 matches the dev server (avoids ::1-only listen).
     * Avoid `host: true` here: it enumerates all interfaces and can throw ERR_SYSTEM_ERROR in some environments.
     */
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
