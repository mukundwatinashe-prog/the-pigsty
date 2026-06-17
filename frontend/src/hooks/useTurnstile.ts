import { useCallback, useEffect, useRef } from 'react';

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      size?: 'normal' | 'compact' | 'invisible';
      callback?: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
    },
  ) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${TURNSTILE_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Turnstile failed to load')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Turnstile failed to load'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '';

/**
 * Invisible Cloudflare Turnstile — call getToken() before each chat send.
 * When VITE_TURNSTILE_SITE_KEY is unset, getToken() resolves to undefined (dev only; production API rejects).
 */
export function useTurnstile(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const pendingRef = useRef<{
    resolve: (token: string) => void;
    reject: (error: Error) => void;
  } | null>(null);

  useEffect(() => {
    if (!active || !turnstileSiteKey || !containerRef.current) return;

    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || widgetIdRef.current || !window.turnstile) return;

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: turnstileSiteKey,
          size: 'invisible',
          callback: (token) => {
            pendingRef.current?.resolve(token);
            pendingRef.current = null;
          },
          'error-callback': () => {
            pendingRef.current?.reject(new Error('Human verification failed. Please try again.'));
            pendingRef.current = null;
          },
          'expired-callback': () => {
            if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
          },
        });
      })
      .catch(() => {
        /* load failure — getToken will surface an error */
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [active]);

  const getToken = useCallback(async (): Promise<string | undefined> => {
    if (!turnstileSiteKey) return undefined;
    if (!widgetIdRef.current || !window.turnstile) {
      throw new Error('Human verification is still loading. Please wait a moment and try again.');
    }

    return new Promise((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      window.turnstile!.execute(widgetIdRef.current!);
    });
  }, []);

  return { containerRef, getToken, enabled: Boolean(turnstileSiteKey) };
}
