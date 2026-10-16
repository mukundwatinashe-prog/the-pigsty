import { describe, it, expect } from 'vitest';
import { isFutureCalendarDate } from './calendarDate';

const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

describe('isFutureCalendarDate', () => {
  it('accepts past dates, today and tomorrow (timezone slack)', () => {
    expect(isFutureCalendarDate('2025-06-01')).toBe(false);
    expect(isFutureCalendarDate(isoDay(0))).toBe(false);
    expect(isFutureCalendarDate(isoDay(1))).toBe(false);
  });

  it('rejects dates clearly in the future', () => {
    expect(isFutureCalendarDate(isoDay(3))).toBe(true);
    expect(isFutureCalendarDate('2030-01-01')).toBe(true);
  });

  it('ignores empty and unparseable values (other rules handle those)', () => {
    expect(isFutureCalendarDate('')).toBe(false);
    expect(isFutureCalendarDate(null)).toBe(false);
    expect(isFutureCalendarDate('not a date')).toBe(false);
  });
});
