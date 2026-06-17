/**
 * Normalize to digits only for storage and lookup (8–15 digits, ITU-T style).
 * Does not validate country-specific rules.
 */
export function normalizePhone(input: string): string | null {
  const digits = String(input).replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/**
 * Format stored digits for Twilio SMS (E.164).
 * UK local numbers often start with 0 (e.g. 07…) — map to +44.
 */
export function toSmsE164(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.startsWith('0')) return `+44${d.slice(1)}`;
  return `+${d}`;
}
