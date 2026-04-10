import { Prisma } from '@prisma/client';

/** Standard: 50 kg = 3 buckets (same for all feed types). */
export const KG_PER_3_BUCKETS = new Prisma.Decimal(50);
export const BUCKETS_PER_50KG = new Prisma.Decimal(3);

export function bucketsToKg(buckets: Prisma.Decimal | number | string): Prisma.Decimal {
  const b = buckets instanceof Prisma.Decimal ? buckets : new Prisma.Decimal(buckets);
  return b.mul(KG_PER_3_BUCKETS).div(BUCKETS_PER_50KG);
}

export function kgToBuckets(kg: Prisma.Decimal | number | string): Prisma.Decimal {
  const k = kg instanceof Prisma.Decimal ? kg : new Prisma.Decimal(kg);
  return k.mul(BUCKETS_PER_50KG).div(KG_PER_3_BUCKETS);
}
