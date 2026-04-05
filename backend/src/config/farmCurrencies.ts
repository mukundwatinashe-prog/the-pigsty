import { z } from 'zod';

/** ISO 4217 codes supported for farm display & reporting (USD, GBP, common African + EUR legacy). */
export const FARM_CURRENCY_CODES = [
  'USD',
  'GBP',
  'EUR',
  'ZAR',
  'NGN',
  'KES',
  'GHS',
  'UGX',
  'ZMW',
  'BWP',
  'TZS',
  'MWK',
  'RWF',
  'ETB',
  'NAD',
  'MZN',
  'ZWL',
  'XOF',
  'XAF',
] as const;

export type FarmCurrencyCode = (typeof FARM_CURRENCY_CODES)[number];

export const farmCurrencySchema = z.enum(FARM_CURRENCY_CODES);

export function isFarmCurrency(code: string): code is FarmCurrencyCode {
  return (FARM_CURRENCY_CODES as readonly string[]).includes(code);
}
