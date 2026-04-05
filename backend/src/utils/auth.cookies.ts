import { Response } from 'express';
import { env } from '../config/env';

export const COOKIE_ACCESS = 'access_token';
export const COOKIE_REFRESH = 'refresh_token';

function parseDurationToMs(s: string): number {
  const m = /^(\d+)(ms|s|m|h|d)$/i.exec(s.trim());
  if (!m) return 15 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  if (u === 'ms') return n;
  if (u === 's') return n * 1000;
  if (u === 'm') return n * 60 * 1000;
  if (u === 'h') return n * 60 * 60 * 1000;
  if (u === 'd') return n * 24 * 60 * 60 * 1000;
  return 15 * 60 * 1000;
}

function cookieBase() {
  return {
    httpOnly: true as const,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api',
  };
}

export function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
  const base = cookieBase();
  res.cookie(COOKIE_ACCESS, tokens.accessToken, {
    ...base,
    maxAge: parseDurationToMs(env.JWT_EXPIRES_IN),
  });
  res.cookie(COOKIE_REFRESH, tokens.refreshToken, {
    ...base,
    maxAge: parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN),
  });
}

export function clearAuthCookies(res: Response) {
  const base = cookieBase();
  res.clearCookie(COOKIE_ACCESS, { ...base });
  res.clearCookie(COOKIE_REFRESH, { ...base });
}
