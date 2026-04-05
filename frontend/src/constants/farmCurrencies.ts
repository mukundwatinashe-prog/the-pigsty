/** Must match backend `FARM_CURRENCY_CODES`. */
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

export const FARM_CURRENCY_OPTIONS: { code: FarmCurrencyCode; label: string }[] = [
  { code: 'USD', label: 'USD — US dollar' },
  { code: 'GBP', label: 'GBP — British pound' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'ZAR', label: 'ZAR — South African rand' },
  { code: 'NGN', label: 'NGN — Nigerian naira' },
  { code: 'KES', label: 'KES — Kenyan shilling' },
  { code: 'GHS', label: 'GHS — Ghanaian cedi' },
  { code: 'UGX', label: 'UGX — Ugandan shilling' },
  { code: 'ZMW', label: 'ZMW — Zambian kwacha' },
  { code: 'BWP', label: 'BWP — Botswana pula' },
  { code: 'TZS', label: 'TZS — Tanzanian shilling' },
  { code: 'MWK', label: 'MWK — Malawian kwacha' },
  { code: 'RWF', label: 'RWF — Rwandan franc' },
  { code: 'ETB', label: 'ETB — Ethiopian birr' },
  { code: 'NAD', label: 'NAD — Namibian dollar' },
  { code: 'MZN', label: 'MZN — Mozambican metical' },
  { code: 'ZWL', label: 'ZWL — Zimbabwean dollar' },
  { code: 'XOF', label: 'XOF — West African CFA franc' },
  { code: 'XAF', label: 'XAF — Central African CFA franc' },
];

export function isFarmCurrency(code: string): code is FarmCurrencyCode {
  return (FARM_CURRENCY_CODES as readonly string[]).includes(code);
}
