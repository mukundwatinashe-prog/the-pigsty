import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
vi.mock('../config/database', () => ({
  default: { farmMember: { findFirst: (...a: unknown[]) => findFirst(...a) } },
}));

import { requireAiAccess } from './aiAccess.middleware';
import { AppError } from './error.middleware';
import type { AuthRequest } from './auth.middleware';
import type { Response } from 'express';

function run(req: Partial<AuthRequest>) {
  return new Promise<AppError | undefined>((resolve) => {
    void requireAiAccess(req as AuthRequest, {} as Response, (err?: unknown) =>
      resolve(err as AppError | undefined),
    );
  });
}

beforeEach(() => findFirst.mockReset());

describe('requireAiAccess', () => {
  it('rejects unauthenticated requests (401)', async () => {
    const err = await run({});
    expect(err?.statusCode).toBe(401);
  });

  it('returns 402 when the user has no paid farm', async () => {
    findFirst.mockResolvedValue(null);
    const err = await run({ userId: 'u1' });
    expect(err?.statusCode).toBe(402);
  });

  it('allows the user through when a paid farm membership exists', async () => {
    findFirst.mockResolvedValue({ id: 'member-1' });
    const err = await run({ userId: 'u1' });
    expect(err).toBeUndefined();
  });

  it('queries only non-deleted, non-FREE farms for the caller', async () => {
    findFirst.mockResolvedValue({ id: 'member-1' });
    await run({ userId: 'u1' });
    const arg = findFirst.mock.calls[0][0] as {
      where: { userId: string; farm: { isDeleted: boolean; plan: { not: string } } };
    };
    expect(arg.where.userId).toBe('u1');
    expect(arg.where.farm.isDeleted).toBe(false);
    expect(arg.where.farm.plan).toEqual({ not: 'FREE' });
  });
});
