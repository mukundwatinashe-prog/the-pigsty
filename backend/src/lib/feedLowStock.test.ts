import { describe, it, expect } from 'vitest';
import { lowStockFeedTypes } from './feedLowStock';

const TYPES = ['MAIZE', 'SOYA', 'PREMIX'] as const;

describe('lowStockFeedTypes', () => {
  it('ignores feed types the farm has never bought', () => {
    expect(lowStockFeedTypes(TYPES, { MAIZE: 0, SOYA: 0, PREMIX: 0 }, { MAIZE: 0, SOYA: 0, PREMIX: 0 }, 50)).toEqual([]);
  });

  it('flags bought feed at or below the threshold', () => {
    const purchased = { MAIZE: 500, SOYA: 100, PREMIX: 25 };
    const stock = { MAIZE: 433.3, SOYA: 50, PREMIX: 0 };
    expect(lowStockFeedTypes(TYPES, purchased, stock, 50)).toEqual(['SOYA', 'PREMIX']);
  });
});
