import { describe, it, expect } from 'vitest';
import { bucketsToKg, kgToBuckets } from './feedConversion';

describe('feed bucket <-> kg conversion', () => {
  it('converts the standard 3 buckets to 50 kg', () => {
    expect(bucketsToKg(3).toNumber()).toBe(50);
  });

  it('converts 50 kg back to 3 buckets', () => {
    expect(kgToBuckets(50).toNumber()).toBe(3);
  });

  it('round-trips an arbitrary value', () => {
    const kg = kgToBuckets(120);
    expect(bucketsToKg(kg).toNumber()).toBeCloseTo(120, 6);
  });

  it('accepts numeric and string inputs', () => {
    expect(bucketsToKg('6').toNumber()).toBe(100);
  });
});
