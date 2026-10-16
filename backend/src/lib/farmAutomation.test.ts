import { describe, it, expect } from 'vitest';
import { turnsOnEnterpriseAutomation } from './farmAutomation';

describe('turnsOnEnterpriseAutomation', () => {
  it('allows the settings form defaults (everything off)', () => {
    expect(
      turnsOnEnterpriseAutomation({
        reportEmailCadence: 'OFF',
        alertSmsPhone: null,
        alertSmsFarrowing: false,
        alertSmsLowStock: false,
      }),
    ).toBe(false);
  });

  it('allows an update that omits automation fields', () => {
    expect(turnsOnEnterpriseAutomation({})).toBe(false);
  });

  it('treats a blank SMS phone as off', () => {
    expect(turnsOnEnterpriseAutomation({ alertSmsPhone: '   ' })).toBe(false);
  });

  it('flags scheduled report emails', () => {
    expect(turnsOnEnterpriseAutomation({ reportEmailCadence: 'WEEKLY' })).toBe(true);
    expect(turnsOnEnterpriseAutomation({ reportEmailCadence: 'MONTHLY' })).toBe(true);
  });

  it('flags SMS alerts and an SMS phone number', () => {
    expect(turnsOnEnterpriseAutomation({ alertSmsFarrowing: true })).toBe(true);
    expect(turnsOnEnterpriseAutomation({ alertSmsLowStock: true })).toBe(true);
    expect(turnsOnEnterpriseAutomation({ alertSmsPhone: '+27820000001' })).toBe(true);
  });
});
