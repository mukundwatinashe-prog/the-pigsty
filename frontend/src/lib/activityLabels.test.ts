import { describe, it, expect } from 'vitest';
import { actionLabel, describeActivity, entityLabel } from './activityLabels';

describe('activity labels', () => {
  it('describes known audit entries in plain English', () => {
    expect(describeActivity('BULK_CREATE', 'WeightLog')).toBe('logged weights for a pen');
    expect(describeActivity('CREATE', 'PigObservation')).toBe('logged a health observation');
  });

  it('falls back to readable words for unknown codes', () => {
    expect(describeActivity('ARCHIVE', 'FeedPurchase')).toBe('archive feed purchase');
  });

  it('labels actions and entities for the audit table', () => {
    expect(actionLabel('BULK_CREATE')).toBe('Added (bulk)');
    expect(actionLabel('SOMETHING_NEW')).toBe('Something new');
    expect(entityLabel('WeightLog')).toBe('Weight log');
    expect(entityLabel('FarmMember')).toBe('Team member');
  });
});
