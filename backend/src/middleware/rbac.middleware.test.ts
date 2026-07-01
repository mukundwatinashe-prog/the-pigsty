import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Prisma singleton before importing the middleware under test.
const findFarmMember = vi.fn();
const findFarm = vi.fn();
vi.mock('../config/database', () => ({
  default: {
    farmMember: { findUnique: (...a: unknown[]) => findFarmMember(...a) },
    farm: { findUnique: (...a: unknown[]) => findFarm(...a) },
  },
}));

import { requireFarmAccess } from './rbac.middleware';
import { AppError } from './error.middleware';
import type { FarmRequest } from './rbac.middleware';
import type { Response } from 'express';

function run(mw: ReturnType<typeof requireFarmAccess>, req: Partial<FarmRequest>) {
  return new Promise<AppError | undefined>((resolve) => {
    mw(req as FarmRequest, {} as Response, (err?: unknown) =>
      resolve(err as AppError | undefined),
    );
  });
}

const baseReq = (): Partial<FarmRequest> => ({
  userId: 'user-1',
  params: { farmId: 'farm-1' } as never,
  body: {},
});

beforeEach(() => {
  findFarmMember.mockReset();
  findFarm.mockReset();
});

describe('requireFarmAccess', () => {
  it('rejects requests with no farmId (400)', async () => {
    const err = await run(requireFarmAccess('pigs:read'), { userId: 'u', params: {} as never, body: {} });
    expect(err?.statusCode).toBe(400);
  });

  it('rejects a non-member of the farm (403)', async () => {
    findFarmMember.mockResolvedValue(null);
    const err = await run(requireFarmAccess('pigs:read'), baseReq());
    expect(err?.statusCode).toBe(403);
  });

  it('rejects a member lacking the required permission (403)', async () => {
    findFarmMember.mockResolvedValue({ role: 'WORKER' });
    // WORKER cannot delete pigs
    const err = await run(requireFarmAccess('pigs:delete'), baseReq());
    expect(err?.statusCode).toBe(403);
  });

  it('returns 404 when the farm is soft-deleted', async () => {
    findFarmMember.mockResolvedValue({ role: 'OWNER' });
    findFarm.mockResolvedValue({ plan: 'ENTERPRISE', isDeleted: true });
    const err = await run(requireFarmAccess('pigs:read'), baseReq());
    expect(err?.statusCode).toBe(404);
  });

  it('blocks reports on the FREE plan with 402', async () => {
    findFarmMember.mockResolvedValue({ role: 'OWNER' });
    findFarm.mockResolvedValue({ plan: 'FREE', isDeleted: false });
    const err = await run(requireFarmAccess('reports:read'), baseReq());
    expect(err?.statusCode).toBe(402);
  });

  it('blocks bulk import and team management on FREE with 402', async () => {
    findFarmMember.mockResolvedValue({ role: 'OWNER' });
    findFarm.mockResolvedValue({ plan: 'FREE', isDeleted: false });
    expect((await run(requireFarmAccess('import:write'), baseReq()))?.statusCode).toBe(402);
    expect((await run(requireFarmAccess('users:manage'), baseReq()))?.statusCode).toBe(402);
  });

  it('allows a permitted action and populates req.farmId / req.memberRole', async () => {
    findFarmMember.mockResolvedValue({ role: 'OWNER' });
    findFarm.mockResolvedValue({ plan: 'ENTERPRISE', isDeleted: false });
    const req = baseReq();
    const err = await run(requireFarmAccess('pigs:write'), req);
    expect(err).toBeUndefined();
    expect(req.farmId).toBe('farm-1');
    expect(req.memberRole).toBe('OWNER');
  });

  it('allows pig CRUD on FREE (core feature is not gated)', async () => {
    findFarmMember.mockResolvedValue({ role: 'OWNER' });
    findFarm.mockResolvedValue({ plan: 'FREE', isDeleted: false });
    const err = await run(requireFarmAccess('pigs:write'), baseReq());
    expect(err).toBeUndefined();
  });
});
