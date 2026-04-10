/**
 * Normalize to digits only for storage and lookup (8–15 digits, ITU-T style).
 * Does not validate country-specific rules.
 */
export function normalizePhone(input: string): string | null {
  const digits = String(input).replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}
