import { describe, it, expect } from 'vitest';
import { averageDailyGain } from './averageDailyGain';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('averageDailyGain', () => {
  it('uses the entry weight as the starting point', () => {
    // 35 kg on 1 Aug -> 39.5 kg on 15 Oct (75 days)
    expect(averageDailyGain({ date: d('2026-08-01'), weight: 35 }, [{ date: d('2026-10-15'), weight: 39.5 }])).toBeCloseTo(0.06, 2);
  });

  it('spans first to last point when several logs exist', () => {
    const logs = [
      { date: d('2026-09-01'), weight: 40 },
      { date: d('2026-09-11'), weight: 46 },
    ];
    expect(averageDailyGain({ date: d('2026-08-22'), weight: 34 }, logs)).toBeCloseTo(0.6, 5);
  });

  it('returns null without two points in time', () => {
    expect(averageDailyGain(null, [{ date: d('2026-10-15'), weight: 38 }])).toBeNull();
    expect(averageDailyGain({ date: d('2026-10-15'), weight: 35 }, [{ date: d('2026-10-15'), weight: 38 }])).toBeNull();
  });
});
