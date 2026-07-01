import { describe, it, expect } from 'vitest';
import { isPlanUpgradeError, planUpgradeMessage, PAID_REPORT_IDS } from './planAccess';

describe('isPlanUpgradeError', () => {
  it('is true only for HTTP 402 responses', () => {
    expect(isPlanUpgradeError({ response: { status: 402 } })).toBe(true);
    expect(isPlanUpgradeError({ response: { status: 403 } })).toBe(false);
    expect(isPlanUpgradeError(new Error('network'))).toBe(false);
  });
});

describe('planUpgradeMessage', () => {
  it('prefers the server-provided message', () => {
    const msg = planUpgradeMessage({ response: { data: { message: 'Reports need Grower.' } } });
    expect(msg).toBe('Reports need Grower.');
  });

  it('falls back when no server message is present', () => {
    expect(planUpgradeMessage({}, 'default text')).toBe('default text');
    expect(planUpgradeMessage({ response: { data: { message: '  ' } } }, 'default text')).toBe(
      'default text',
    );
  });
});

describe('PAID_REPORT_IDS', () => {
  it('gates paid reports but not the free audit/activity log', () => {
    expect(PAID_REPORT_IDS.has('herd_inventory')).toBe(true);
    expect(PAID_REPORT_IDS.has('activity_log')).toBe(false);
  });
});
