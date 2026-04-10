import type { FeedType } from '../types';

export type FeedPurchasePriceUnit = 'KG' | 'TONNE';

/** Farm-currency total for quantity (kg) from stored unit prices. */
export function previewFeedPurchaseCost(
  quantityKg: number,
  feedType: FeedType,
  unit: FeedPurchasePriceUnit,
  prices: Partial<Record<FeedType, number>> | null | undefined,
): number | null {
  const p = prices?.[feedType];
  if (p == null || !Number.isFinite(p) || p < 0) return null;
  if (p === 0) return null;
  const perKg = unit === 'TONNE' ? p / 1000 : p;
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) return null;
  return Math.round(quantityKg * perKg * 100) / 100;
}

export function feedPriceUnitLabel(unit: FeedPurchasePriceUnit): string {
  return unit === 'TONNE' ? 'per metric tonne (1000 kg)' : 'per kg';
}
