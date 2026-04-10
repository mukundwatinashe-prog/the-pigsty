import type { Pig, PigStage } from '@prisma/client';
import prisma from '../config/database';
import {
  ageDaysFromBirth,
  idealGrowthStageFromAgeDays,
  isAutoManagedGrowthStage,
} from '../lib/pigGrowthStage';

type PigStageSyncFields = Pick<Pig, 'id' | 'stage' | 'dateOfBirth' | 'status'>;

/**
 * For active pigs with a known DOB in a growth stage, updates `stage` when age crosses band thresholds.
 * Does not change boars, sows, or gilts.
 */
export async function syncPigGrowthStageIfNeeded(
  pig: PigStageSyncFields,
  asOf: Date = new Date(),
): Promise<PigStage | null> {
  if (pig.status !== 'ACTIVE') return null;
  if (!pig.dateOfBirth) return null;
  if (!isAutoManagedGrowthStage(pig.stage)) return null;

  const ageDays = ageDaysFromBirth(pig.dateOfBirth, asOf);
  const ideal = idealGrowthStageFromAgeDays(ageDays);
  if (ideal === pig.stage) return null;

  await prisma.pig.update({
    where: { id: pig.id },
    data: { stage: ideal },
  });
  return ideal;
}
