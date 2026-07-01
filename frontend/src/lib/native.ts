import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * True when running inside a Capacitor native shell (iOS/Android), false on the web.
 * Native builds authenticate with Bearer tokens because cross-site cookies to the
 * API are unreliable inside a WebView; the web build keeps the httpOnly-cookie flow.
 */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

const ACCESS_KEY = 'pigsty.accessToken';
const REFRESH_KEY = 'pigsty.refreshToken';

// In-memory cache so the axios request interceptor can read tokens synchronously
// after a one-time async hydrate from device storage.
let cachedAccess: string | null = null;
let cachedRefresh: string | null = null;
let hydrated = false;

/** Load persisted tokens from device storage once. Safe to call repeatedly. */
export async function hydrateAuthTokens(): Promise<void> {
  if (hydrated) return;
  const [a, r] = await Promise.all([
    Preferences.get({ key: ACCESS_KEY }),
    Preferences.get({ key: REFRESH_KEY }),
  ]);
  cachedAccess = a.value;
  cachedRefresh = r.value;
  hydrated = true;
}

export function getAccessTokenSync(): string | null {
  return cachedAccess;
}

export function getRefreshTokenSync(): string | null {
  return cachedRefresh;
}

export async function setAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
  cachedAccess = accessToken;
  cachedRefresh = refreshToken;
  hydrated = true;
  await Promise.all([
    Preferences.set({ key: ACCESS_KEY, value: accessToken }),
    Preferences.set({ key: REFRESH_KEY, value: refreshToken }),
  ]);
}

export async function clearAuthTokens(): Promise<void> {
  cachedAccess = null;
  cachedRefresh = null;
  hydrated = true;
  await Promise.all([
    Preferences.remove({ key: ACCESS_KEY }),
    Preferences.remove({ key: REFRESH_KEY }),
  ]);
}
