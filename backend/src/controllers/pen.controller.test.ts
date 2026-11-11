import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Prisma singleton before importing the controller under test.
const penFindUnique = vi.fn();
const penUpdate = vi.fn();
const penDelete = vi.fn();
vi.mock('../config/database', () => ({
  default: {
    pen: {
      findUnique: (...a: unknown[]) => penFindUnique(...a),
      update: (...a: unknown[]) => penUpdate(...a),
      delete: (...a: unknown[]) => penDelete(...a),
    },
  },
}));
vi.mock('../services/audit.service', () => ({ AuditService: { log: vi.fn() } }));
vi.mock('../services/farmNotify.service', () => ({ notifyFarmLeads: vi.fn() }));

import { PenController } from './pen.controller';
import { AppError } from '../middleware/error.middleware';
import type { FarmRequest } from '../middleware/rbac.middleware';
import type { Response } from 'express';

async function invoke(
  handler: (req: FarmRequest, res: Response, next: (e?: unknown) => void) => Promise<void>,
  req: Partial<FarmRequest>,
) {
  const res = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  (res.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(res);
  let nextErr: AppError | undefined;
  await handler(req as FarmRequest, res, (e?: unknown) => {
    nextErr = e as AppError | undefined;
  });
  return { nextErr, res };
}

const reqFor = (penId: string, body: Record<string, unknown> = {}): Partial<FarmRequest> => ({
  userId: 'user-1',
  farmId: 'farm-1',
  params: { penId } as never,
  body,
});

beforeEach(() => {
  penFindUnique.mockReset();
  penUpdate.mockReset();
  penDelete.mockReset();
});

describe('PenController tenant isolation (cross-farm IDOR)', () => {
  it('update: a pen owned by another farm returns 404 and is NOT modified', async () => {
    penFindUnique.mockResolvedValue({ farmId: 'farm-OTHER' });
    const { nextErr } = await invoke(PenController.update, reqFor('pen-x', { name: 'Renamed' }));
    expect(nextErr?.statusCode).toBe(404);
    expect(penUpdate).not.toHaveBeenCalled();
  });

  it('delete: a pen owned by another farm returns 404 and is NOT deleted', async () => {
    penFindUnique.mockResolvedValue({ farmId: 'farm-OTHER' });
    const { nextErr } = await invoke(PenController.delete, reqFor('pen-x'));
    expect(nextErr?.statusCode).toBe(404);
    expect(penDelete).not.toHaveBeenCalled();
  });

  it('delete: a missing pen returns 404', async () => {
    penFindUnique.mockResolvedValue(null);
    const { nextErr } = await invoke(PenController.delete, reqFor('nope'));
    expect(nextErr?.statusCode).toBe(404);
    expect(penDelete).not.toHaveBeenCalled();
  });
});
