import { describe, it, expect } from 'vitest';
import { uniqueConstraintMessage } from './uniqueConstraintMessage';

describe('uniqueConstraintMessage', () => {
  it('explains duplicate pig tags', () => {
    expect(uniqueConstraintMessage(['farmId', 'tagNumber'])).toMatch(/tag number is already used/);
    expect(uniqueConstraintMessage('pigs_farm_id_tag_number_key')).toMatch(/tag number is already used/);
  });

  it('explains duplicate pen names and feed usage days', () => {
    expect(uniqueConstraintMessage(['farmId', 'name'])).toMatch(/pen with this name/);
    expect(uniqueConstraintMessage(['farmId', 'usageDate'])).toMatch(/already logged/);
  });

  it('keeps the phone message and falls back to a generic one', () => {
    expect(uniqueConstraintMessage(['phone_normalized'])).toMatch(/phone number/);
    expect(uniqueConstraintMessage(['email'])).toBe('A record with this value already exists.');
    expect(uniqueConstraintMessage(undefined)).toBe('A record with this value already exists.');
  });
});
