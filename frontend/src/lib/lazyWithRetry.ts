import type { ComponentType, LazyExoticComponent } from 'react';
import { lazy } from 'react';

/** When we last force-reloaded to recover a missing chunk (epoch ms, shared across routes). */
const RELOAD_AT_KEY = 'pigtrack:lazy-reload-at';
/** Don't reload more than once per this window — a tight loop means a real import error, not a stale chunk. */
const RELOAD_COOLDOWN_MS = 10_000;

/**
 * Lazy-load a route chunk, recovering from the classic "stale PWA cache" failure:
 * after a new deploy the old hashed chunk 404s and the dynamic import rejects.
 *
 * We reload to fetch the fresh asset manifest, throttled by a timestamp so a long
 * session that spans several deploys can recover every time — while a genuine
 * import error (which fails again immediately) is retried only once before it
 * surfaces to the ErrorBoundary instead of looping forever.
 *
 * (Previously this guarded once-per-route-per-session, so a second deploy in the
 * same session showed the crash screen — the cause of repeated "Something went
 * wrong" reports during frequent deploys.)
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  _routeId: string,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      const last = Number(sessionStorage.getItem(RELOAD_AT_KEY) || 0);
      const now = Date.now();
      if (now - last > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_AT_KEY, String(now));
        window.location.reload();
        // Render nothing until the reload navigates away.
        return { default: (() => null) as unknown as T };
      }
      // Reloaded moments ago and still failing — not a stale chunk. Let it bubble.
      throw error;
    }
  });
}
