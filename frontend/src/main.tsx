import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { initGa4 } from './lib/analytics';

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

initGa4();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
