import type { ComponentType, LazyExoticComponent } from 'react';
import { lazy } from 'react';

/**
 * Retry lazy route chunks once after a failed import (common with stale PWA caches).
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  routeId: string,
): LazyExoticComponent<T> {
  return lazy(async () => {
    const retryKey = `lazy-retry:${routeId}`;
    try {
      return await factory();
    } catch (error) {
      if (!sessionStorage.getItem(retryKey)) {
        sessionStorage.setItem(retryKey, '1');
        window.location.reload();
        return { default: (() => null) as unknown as T };
      }
      sessionStorage.removeItem(retryKey);
      throw error;
    }
  });
}
