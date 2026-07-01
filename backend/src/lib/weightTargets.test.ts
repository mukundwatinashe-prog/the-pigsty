import { describe, it, expect } from 'vitest';
import { targetAdgKgPerDay, compareAdgToTarget } from './weightTargets';

describe('targetAdgKgPerDay', () => {
  it('returns stage-specific targets', () => {
    expect(targetAdgKgPerDay('FINISHER')).toBe(0.75);
    expect(targetAdgKgPerDay('PIGLET')).toBe(0.25);
  });

  it('falls back to a default for unknown stages', () => {
    expect(targetAdgKgPerDay('UNKNOWN')).toBe(0.45);
  });
});

describe('compareAdgToTarget', () => {
  it('flags on_track at/above 95% of target', () => {
    // FINISHER target 0.75 -> 95% = 0.7125
    expect(compareAdgToTarget(0.75, 'FINISHER')).toBe('on_track');
    expect(compareAdgToTarget(0.72, 'FINISHER')).toBe('on_track');
  });

  it('flags below when under 85% of target', () => {
    // FINISHER 85% = 0.6375
    expect(compareAdgToTarget(0.5, 'FINISHER')).toBe('below');
  });

  it('treats the borderline band (85-95%) as on_track', () => {
    // 0.70 is between 0.6375 and 0.7125
    expect(compareAdgToTarget(0.7, 'FINISHER')).toBe('on_track');
  });
});
