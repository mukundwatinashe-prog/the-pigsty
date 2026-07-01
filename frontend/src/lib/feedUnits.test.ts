import { describe, it, expect } from 'vitest';
import { bucketsToKg, kgToBuckets, FEED_TYPES_ORDER, FEED_TYPE_LABELS } from './feedUnits';

describe('feed bucket <-> kg conversion (frontend)', () => {
  it('matches the fixed 3 buckets = 50 kg rule', () => {
    expect(bucketsToKg(3)).toBe(50);
    expect(kgToBuckets(50)).toBe(3);
  });

  it('round-trips a value', () => {
    expect(bucketsToKg(kgToBuckets(120))).toBeCloseTo(120, 6);
  });
});

describe('feed type metadata', () => {
  it('has a label for every ordered feed type', () => {
    for (const type of FEED_TYPES_ORDER) {
      expect(FEED_TYPE_LABELS[type]).toBeTruthy();
    }
  });
});
