import { describe, it, expect } from 'vitest';
import { farrowingEndsCurrentService, weanedExceedsBornAlive } from './farrowing';

describe('weanedExceedsBornAlive', () => {
  it('rejects weaning more than were born alive', () => {
    expect(weanedExceedsBornAlive(5, 8)).toBe(true);
  });

  it('allows equal, fewer, or unknown weaned counts', () => {
    expect(weanedExceedsBornAlive(5, 5)).toBe(false);
    expect(weanedExceedsBornAlive(5, 4)).toBe(false);
    expect(weanedExceedsBornAlive(5, null)).toBe(false);
    expect(weanedExceedsBornAlive(5, undefined)).toBe(false);
  });
});

describe('farrowingEndsCurrentService', () => {
  const serviced = { serviced: true, servicedDate: new Date('2026-09-20') };

  it('ends the service when the sow farrows on or after the service date', () => {
    expect(farrowingEndsCurrentService(serviced, new Date('2027-01-12'))).toBe(true);
    expect(farrowingEndsCurrentService(serviced, new Date('2026-09-20'))).toBe(true);
  });

  it('leaves the service alone for a back-dated earlier litter', () => {
    expect(farrowingEndsCurrentService(serviced, new Date('2026-03-01'))).toBe(false);
  });

  it('ends a service with no recorded date, and ignores unserviced sows', () => {
    expect(farrowingEndsCurrentService({ serviced: true, servicedDate: null }, new Date())).toBe(true);
    expect(farrowingEndsCurrentService({ serviced: false, servicedDate: null }, new Date())).toBe(false);
  });
});
