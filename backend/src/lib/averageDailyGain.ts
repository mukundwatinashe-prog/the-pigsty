export type WeightPoint = { date: Date; weight: number };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Average daily gain from the pig's entry weight (on its acquisition date) through its
 * weight logs. Including the entry weight means one logged weight is enough to show
 * growth. Null when there are fewer than two points or no time has passed.
 */
export function averageDailyGain(entry: WeightPoint | null, logs: WeightPoint[]): number | null {
  const points = [...(entry ? [entry] : []), ...logs].sort((a, b) => a.date.getTime() - b.date.getTime());
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const days = (last.date.getTime() - first.date.getTime()) / DAY_MS;
  if (days <= 0) return null;
  return (last.weight - first.weight) / days;
}
