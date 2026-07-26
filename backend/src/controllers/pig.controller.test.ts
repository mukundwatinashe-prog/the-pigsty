import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Prisma singleton before importing the controller under test.
const pigFindUnique = vi.fn();
const pigDelete = vi.fn();
vi.mock('../config/database', () => ({
  default: {
    pig: {
      findUnique: (...a: unknown[]) => pigFindUnique(...a),
      delete: (...a: unknown[]) => pigDelete(...a),
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
});
