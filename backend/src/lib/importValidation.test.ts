import { describe, it, expect } from 'vitest';
import { isBlankImportRow, parseImportDate } from './importValidation';

describe('isBlankImportRow', () => {
  it('treats rows of nulls and whitespace as blank', () => {
    expect(isBlankImportRow({ 'Tag Number': null, Breed: '', Notes: '   ' })).toBe(true);
    expect(isBlankImportRow({})).toBe(true);
    expect(isBlankImportRow(null)).toBe(true);
  });

  it('keeps rows with any content so they are validated', () => {
    expect(isBlankImportRow({ 'Tag Number': 'PIG-9', Breed: null })).toBe(false);
    expect(isBlankImportRow({ 'Tag Number': null, Notes: 'only a note' })).toBe(false);
    expect(isBlankImportRow({ 'Entry Weight (kg)': 0 })).toBe(false);
  });
});

describe('parseImportDate', () => {
  // Calendar dates must not shift with the server's timezone (stored as UTC midnight).
  it('parses DD/MM/YYYY as that calendar day in UTC', () => {
    expect(parseImportDate('20/07/2026')?.toISOString()).toBe('2026-07-20T00:00:00.000Z');
    expect(parseImportDate('1-9-2026')?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('parses Excel serial dates as that calendar day in UTC', () => {
    // 46223 is 20 Jul 2026 in Excel's 1900 date system.
    expect(parseImportDate(46223)?.toISOString()).toBe('2026-07-20T00:00:00.000Z');
  });

  it('keeps ISO dates and rejects junk', () => {
    expect(parseImportDate('2026-08-15')?.toISOString()).toBe('2026-08-15T00:00:00.000Z');
    expect(parseImportDate('not a date')).toBeNull();
    expect(parseImportDate('')).toBeNull();
  });
});
