import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const findUser = vi.fn();
vi.mock('../config/database', () => ({
  default: { user: { findUnique: (...a: unknown[]) => findUser(...a) } },
}));

import { authenticate, type AuthRequest } from './auth.middleware';
import { AppError } from './error.middleware';
import { COOKIE_ACCESS } from '../utils/auth.cookies';
import type { Response } from 'express';

function run(req: Partial<AuthRequest>) {
  return new Promise<AppError | undefined>((resolve) => {
    authenticate(req as AuthRequest, {} as Response, (err?: unknown) =>
      resolve(err as AppError | undefined),
    );
  });
}

const sign = (payload: object) => jwt.sign(payload, process.env.JWT_SECRET as string);

beforeEach(() => findUser.mockReset());

describe('authenticate', () => {
  it('rejects when no token is present (401)', async () => {
    const err = await run({ cookies: {}, headers: {} });
    expect(err?.statusCode).toBe(401);
  });

  it('rejects a token with a bad signature (401)', async () => {
    const bad = jwt.sign({ userId: 'u1', tv: 0 }, 'a-totally-different-secret');
    const err = await run({ cookies: { [COOKIE_ACCESS]: bad }, headers: {} });
    expect(err?.statusCode).toBe(401);
  });

  it('rejects when the token version is stale (revoked session)', async () => {
    findUser.mockResolvedValue({ tokenVersion: 3 });
    const token = sign({ userId: 'u1', tv: 1 });
    const err = await run({ cookies: { [COOKIE_ACCESS]: token }, headers: {} });
    expect(err?.statusCode).toBe(401);
  });

  it('rejects when the user no longer exists', async () => {
    findUser.mockResolvedValue(null);
    const token = sign({ userId: 'ghost', tv: 0 });
    const err = await run({ cookies: { [COOKIE_ACCESS]: token }, headers: {} });
    expect(err?.statusCode).toBe(401);
  });

  it('accepts a valid cookie token and sets req.userId', async () => {
    findUser.mockResolvedValue({ tokenVersion: 0 });
    const token = sign({ userId: 'u1', tv: 0 });
    const req: Partial<AuthRequest> = { cookies: { [COOKIE_ACCESS]: token }, headers: {} };
    const err = await run(req);
    expect(err).toBeUndefined();
    expect(req.userId).toBe('u1');
  });

  it('accepts a valid Bearer token when no cookie is present', async () => {
    findUser.mockResolvedValue({ tokenVersion: 0 });
    const token = sign({ userId: 'u2', tv: 0 });
    const req: Partial<AuthRequest> = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const err = await run(req);
    expect(err).toBeUndefined();
    expect(req.userId).toBe('u2');
  });
});
