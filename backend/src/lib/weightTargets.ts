/** Typical target average daily gain (kg/day) by stage for grow-finish comparison. */
export function targetAdgKgPerDay(stage: string): number {
  switch (stage) {
    case 'PIGLET':
      return 0.25;
    case 'WEANER':
      return 0.45;
    case 'GROWER':
      return 0.65;
    case 'FINISHER':
      return 0.75;
    case 'PORKER':
      return 0.7;
    case 'BOAR':
    case 'SOW':
    case 'GILT':
      return 0.35;
    default:
      return 0.45;
  }
}

export type WeightVsTarget = 'on_track' | 'below' | 'n_a';

/** Green if ADG meets or exceeds 95% of target; red if below 85%; else treat as on_track (borderline). */
export function compareAdgToTarget(actualAdg: number, stage: string): WeightVsTarget {
  const target = targetAdgKgPerDay(stage);
  if (target <= 0) return 'n_a';
  if (actualAdg >= target * 0.95) return 'on_track';
  if (actualAdg < target * 0.85) return 'below';
  return 'on_track';
}
