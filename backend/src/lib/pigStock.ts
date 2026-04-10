import type { Prisma } from '@prisma/client';

/** Filter pigs that count as current stock (for pen occupancy, pen detail list, etc.). */
export const pigOnStockOnlyWhere: Prisma.PigWhereInput = {
  status: { notIn: ['SOLD', 'DECEASED'] },
};

/** Sold and deceased animals are not current stock (inventory, pens, plan limits). */
export function onHandPigsWhere(farmId: string): Prisma.PigWhereInput {
  return {
    farmId,
    ...pigOnStockOnlyWhere,
  };
}
