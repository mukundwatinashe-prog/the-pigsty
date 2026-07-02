import { describe, it, expect, vi, beforeEach } from 'vitest';

// A single mock object doubles as the Prisma client and the interactive
// transaction handle (matching how deleteAccountById uses `tx`).
const db = vi.hoisted(() => {
  const d = {
    user: { findUnique: vi.fn(), delete: vi.fn() },
    farm: { updateMany: vi.fn() },
    weightLog: { deleteMany: vi.fn() },
    auditLog: { deleteMany: vi.fn() },
    pigObservation: { deleteMany: vi.fn() },
    feedDailyUsage: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  d.$transaction.mockImplementation(async (cb: (tx: typeof d) => unknown) => cb(d));
  return d;
});

vi.mock('../config/database', () => ({ default: db }));

import { AdminService } from './admin.service';

const ownedFarm = (opts: { members: number; isDeleted?: boolean; id?: string; name?: string }) => ({
  role: 'OWNER',
  farm: {
    id: opts.id ?? 'farm-1',
    name: opts.name ?? 'My Farm',
    isDeleted: opts.isDeleted ?? false,
    _count: { members: opts.members },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
});

describe('AdminService.deleteAccountById', () => {
  it('returns null when the user does not exist', async () => {
    db.user.findUnique.mockResolvedValue(null);
    expect(await AdminService.deleteAccountById('ghost')).toBeNull();
    expect(db.user.delete).not.toHaveBeenCalled();
  });

  it('refuses when the user owns a farm that still has other members', async () => {
    db.user.findUnique.mockResolvedValue({ farmMemberships: [ownedFarm({ members: 3 })] });
    await expect(AdminService.deleteAccountById('u1')).rejects.toMatchObject({ statusCode: 400 });
    expect(db.user.delete).not.toHaveBeenCalled();
    expect(db.farm.updateMany).not.toHaveBeenCalled();
  });

  it('archives solo-owned farms and deletes the user', async () => {
    db.user.findUnique.mockResolvedValue({
      farmMemberships: [ownedFarm({ members: 1, id: 'solo-farm' })],
    });

    const result = await AdminService.deleteAccountById('u1');

    expect(result).toEqual({ ok: true });
    expect(db.farm.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['solo-farm'] } },
      data: { isDeleted: true },
    });
    expect(db.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('ignores already-deleted farms and non-owner memberships', async () => {
    db.user.findUnique.mockResolvedValue({
      farmMemberships: [
        ownedFarm({ members: 5, isDeleted: true }), // deleted -> not a blocker
        { role: 'WORKER', farm: { id: 'other', name: 'x', isDeleted: false, _count: { members: 9 } } },
      ],
    });

    const result = await AdminService.deleteAccountById('u1');

    expect(result).toEqual({ ok: true });
    // No live sole-owned farms, so nothing to archive.
    expect(db.farm.updateMany).not.toHaveBeenCalled();
    expect(db.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });
});
