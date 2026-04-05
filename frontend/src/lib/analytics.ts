declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Load gtag.js when VITE_GA_MEASUREMENT_ID is set (index.html already defines dataLayer + gtag stub). */
export function initGa4() {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!id || typeof document === 'undefined') return;
  const existing = document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`);
  if (existing) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  script.onload = () => {
    window.gtag?.('config', id);
  };
  document.head.appendChild(script);
}

/**
 * Push to dataLayer (Google Tag Manager / GA4) and log in dev.
 * Set VITE_GA_MEASUREMENT_ID and load gtag in index.html to enable GA4.
 */
export function track(event: string, params?: Record<string, unknown>) {
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...params });
    if (typeof window.gtag === 'function' && import.meta.env.VITE_GA_MEASUREMENT_ID) {
      window.gtag('event', event, params ?? {});
    }
  } catch {
    /* ignore */
  }
  if (import.meta.env.DEV) {
    console.debug('[analytics]', event, params ?? {});
  }
}
