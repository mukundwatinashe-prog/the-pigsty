import { describe, it, expect } from 'vitest';
import { normalizePhone, toSmsE164 } from './phone';

describe('normalizePhone', () => {
  it('strips non-digits and keeps 8-15 digit numbers', () => {
    expect(normalizePhone('+44 7911 123456')).toBe('447911123456');
    expect(normalizePhone('(078) 1234-5678')).toBe('07812345678');
  });

  it('rejects numbers that are too short or too long', () => {
    expect(normalizePhone('1234567')).toBeNull(); // 7 digits
    expect(normalizePhone('1234567890123456')).toBeNull(); // 16 digits
  });

  it('accepts boundary lengths (8 and 15)', () => {
    expect(normalizePhone('12345678')).toBe('12345678');
    expect(normalizePhone('123456789012345')).toBe('123456789012345');
  });

  it('returns null when no digits are present', () => {
    expect(normalizePhone('not a phone')).toBeNull();
  });
});

describe('toSmsE164', () => {
  it('maps a leading 0 (UK local) to +44', () => {
    expect(toSmsE164('07812345678')).toBe('+447812345678');
  });

  it('prefixes a plain international number with +', () => {
    expect(toSmsE164('447812345678')).toBe('+447812345678');
  });
});
