import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App';
import { initGa4 } from './lib/analytics';
import { isNativeApp } from './lib/native';

// Error monitoring — no-op until VITE_SENTRY_DSN is configured at build time.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
  });
}

/** In dev, remove any PWA service worker left over from `preview`/production so CSS/JS always match the running server. */
if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const r of regs) void r.unregister();
  });
  if ('caches' in window) {
    void caches.keys().then((keys) => {
      for (const key of keys) {
        if (/workbox|precache|pwa|vite-plugin/i.test(key)) void caches.delete(key);
      }
    });
  }
}

// Register the PWA service worker on the WEB only. Inside the native Capacitor
// shell the app is served from the local bundle, so a SW is redundant and can
// serve stale assets after an app update — and native shells clean up any SW a
// previous web session may have left behind.
if (isNativeApp()) {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) void r.unregister();
    });
  }
} else if (!import.meta.env.DEV) {
  registerSW({ immediate: true });
}

initGa4();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
