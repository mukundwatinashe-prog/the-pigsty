import type { FeedType } from '../types';

/** 50 kg = 3 buckets (fixed conversion). */
const KG_PER_3_BUCKETS = 50;
const BUCKETS_PER_50KG = 3;

export function bucketsToKg(buckets: number): number {
  return (buckets * KG_PER_3_BUCKETS) / BUCKETS_PER_50KG;
}

export function kgToBuckets(kg: number): number {
  return (kg * BUCKETS_PER_50KG) / KG_PER_3_BUCKETS;
}

export const FEED_TYPE_LABELS: Record<FeedType, string> = {
  MAIZE_CRECHE: 'Maize (Crèche)',
  SOYA: 'Soya',
  PREMIX: 'Premix',
  CONCENTRATE: 'Concentrate',
  LACTATING: 'Lactating',
  WEANER: 'Weaner',
};

/** Display order for dashboards, purchases, and daily log */
export const FEED_TYPES_ORDER: FeedType[] = [
  'MAIZE_CRECHE',
  'SOYA',
  'PREMIX',
  'CONCENTRATE',
  'LACTATING',
  'WEANER',
];
