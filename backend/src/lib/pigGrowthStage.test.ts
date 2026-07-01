import { describe, it, expect } from 'vitest';
import {
  isAutoManagedGrowthStage,
  ageDaysFromBirth,
  idealGrowthStageFromAgeDays,
} from './pigGrowthStage';

describe('isAutoManagedGrowthStage', () => {
  it('recognizes grow-out stages and excludes breeding stock', () => {
    expect(isAutoManagedGrowthStage('WEANER')).toBe(true);
    expect(isAutoManagedGrowthStage('FINISHER')).toBe(true);
    expect(isAutoManagedGrowthStage('SOW')).toBe(false);
    expect(isAutoManagedGrowthStage('BOAR')).toBe(false);
  });
});

describe('ageDaysFromBirth', () => {
  it('counts whole calendar days', () => {
    expect(ageDaysFromBirth(new Date('2026-01-01'), new Date('2026-01-08'))).toBe(7);
    expect(ageDaysFromBirth(new Date('2026-01-01'), new Date('2026-01-01'))).toBe(0);
  });

  it('ignores time-of-day (calendar-based)', () => {
    expect(
      ageDaysFromBirth(new Date('2026-01-01T23:00:00'), new Date('2026-01-02T01:00:00')),
    ).toBe(1);
  });
});

describe('idealGrowthStageFromAgeDays', () => {
  it('maps age bands to the expected stage', () => {
    expect(idealGrowthStageFromAgeDays(0)).toBe('PIGLET');
    expect(idealGrowthStageFromAgeDays(27)).toBe('PIGLET');
    expect(idealGrowthStageFromAgeDays(28)).toBe('WEANER');
    expect(idealGrowthStageFromAgeDays(69)).toBe('WEANER');
    expect(idealGrowthStageFromAgeDays(70)).toBe('PORKER');
    expect(idealGrowthStageFromAgeDays(112)).toBe('GROWER');
    expect(idealGrowthStageFromAgeDays(154)).toBe('FINISHER');
    expect(idealGrowthStageFromAgeDays(400)).toBe('FINISHER');
  });
});
