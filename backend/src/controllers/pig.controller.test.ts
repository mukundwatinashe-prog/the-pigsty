import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Prisma singleton before importing the controller under test.
const pigFindUnique = vi.fn();
const pigDelete = vi.fn();
const pigUpdate = vi.fn();
const pigCreate = vi.fn();
const penFindUnique = vi.fn();
vi.mock('../config/database', () => ({
  default: {
    pig: {
      findUnique: (...a: unknown[]) => pigFindUnique(...a),
      delete: (...a: unknown[]) => pigDelete(...a),
      update: (...a: unknown[]) => pigUpdate(...a),
      create: (...a: unknown[]) => pigCreate(...a),
    },
    pen: {
      findUnique: (...a: unknown[]) => penFindUnique(...a),
    },
  },
}));
// Audit logging is a side effect we don't exercise here.
vi.mock('../services/audit.service', () => ({ AuditService: { log: vi.fn() } }));

import { PigController } from './pig.controller';
import { AppError } from '../middleware/error.middleware';
import type { FarmRequest } from '../middleware/rbac.middleware';
import type { Response } from 'express';

function mockRes() {
  const res = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  (res.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

/** Run a controller handler and capture whether it errored (via next) or responded. */
async function invoke(
  handler: (req: FarmRequest, res: Response, next: (e?: unknown) => void) => Promise<void>,
  req: Partial<FarmRequest>,
) {
  const res = mockRes();
  let nextErr: AppError | undefined;
  await handler(req as FarmRequest, res, (e?: unknown) => {
    nextErr = e as AppError | undefined;
  });
  return { nextErr, res };
}

const reqFor = (pigId: string): Partial<FarmRequest> => ({
  userId: 'user-1',
  farmId: 'farm-1',
  params: { pigId } as never,
  body: {},
});

beforeEach(() => {
  pigFindUnique.mockReset();
  pigDelete.mockReset();
  pigUpdate.mockReset();
  pigCreate.mockReset();
  penFindUnique.mockReset();
});

describe('PigController tenant isolation (cross-farm IDOR)', () => {
  it('getById: a pig owned by another farm returns 404, not the record', async () => {
    pigFindUnique.mockResolvedValue({ id: 'pig-x', farmId: 'farm-OTHER', tagNumber: 'T-1' });
    const { nextErr, res } = await invoke(PigController.getById, reqFor('pig-x'));
    expect(nextErr?.statusCode).toBe(404);
    expect(res.json).not.toHaveBeenCalled(); // never leak another farm's pig
  });

  it('getById: a missing pig returns 404', async () => {
    pigFindUnique.mockResolvedValue(null);
    const { nextErr } = await invoke(PigController.getById, reqFor('nope'));
    expect(nextErr?.statusCode).toBe(404);
  });

  it('delete: a pig owned by another farm returns 404 and is NOT deleted', async () => {
    pigFindUnique.mockResolvedValue({ id: 'pig-x', farmId: 'farm-OTHER', tagNumber: 'T-1' });
    const { nextErr } = await invoke(PigController.delete, reqFor('pig-x'));
    expect(nextErr?.statusCode).toBe(404);
    expect(pigDelete).not.toHaveBeenCalled(); // the critical assertion: no cross-farm deletion
  });

  it('update: a pig owned by another farm returns 404 and is NOT modified', async () => {
    pigFindUnique.mockResolvedValue({ farmId: 'farm-OTHER' });
    const { nextErr } = await invoke(PigController.update, { ...reqFor('pig-x'), body: { notes: 'x' } });
    expect(nextErr?.statusCode).toBe(404);
    expect(pigUpdate).not.toHaveBeenCalled();
  });

  it('update: moving a pig into another farm\'s pen returns 404 and is NOT modified', async () => {
    pigFindUnique.mockResolvedValue({ farmId: 'farm-1' });
    penFindUnique.mockResolvedValue({ farmId: 'farm-OTHER' });
    const penId = '11111111-1111-4111-8111-111111111111';
    const { nextErr } = await invoke(PigController.update, { ...reqFor('pig-1'), body: { penId } });
    expect(nextErr?.statusCode).toBe(404);
    expect(pigUpdate).not.toHaveBeenCalled();
  });

  it('create: placing a new pig in another farm\'s pen returns 404 and creates nothing', async () => {
    penFindUnique.mockResolvedValue({ farmId: 'farm-OTHER' });
    const body = {
      tagNumber: 'T-9', breed: 'DUROC', stage: 'GROWER', acquisitionDate: '2026-01-01',
      entryWeight: 20, penId: '11111111-1111-4111-8111-111111111111',
    };
    const { nextErr } = await invoke(PigController.create, { ...reqFor(''), body });
    expect(nextErr?.statusCode).toBe(404);
    expect(pigCreate).not.toHaveBeenCalled();
  });
});
