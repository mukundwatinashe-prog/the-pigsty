import type { PigStage } from '@prisma/client';

/** Stages that follow a grow-out timeline from birth (not breeding stock). */
export const GROWTH_STAGES: readonly PigStage[] = [
  'PIGLET',
  'WEANER',
  'PORKER',
  'GROWER',
  'FINISHER',
] as const;

const GROWTH_STAGE_SET = new Set<string>(GROWTH_STAGES);

export function isAutoManagedGrowthStage(stage: PigStage): boolean {
  return GROWTH_STAGE_SET.has(stage);
}

/** Whole calendar days from date of birth to as-of date (local calendar). */
export function ageDaysFromBirth(dob: Date, asOf: Date): number {
  const start = new Date(dob.getFullYear(), dob.getMonth(), dob.getDate());
  const end = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Typical commercial grow-out bands (from birth):
 * piglet ~0–4 wk, weaner to ~10 wk, porker to ~16 wk, grower to ~22 wk, then finisher to market.
 */
export function idealGrowthStageFromAgeDays(ageDays: number): PigStage {
  if (ageDays < 28) return 'PIGLET';
  if (ageDays < 70) return 'WEANER';
  if (ageDays < 112) return 'PORKER';
  if (ageDays < 154) return 'GROWER';
  return 'FINISHER';
}
