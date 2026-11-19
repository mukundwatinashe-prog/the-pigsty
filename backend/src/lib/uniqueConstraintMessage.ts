/** User-facing message for a unique-constraint violation (Prisma P2002), by target columns. */
export function uniqueConstraintMessage(target: unknown): string {
  const cols = (Array.isArray(target) ? target.join(',') : String(target ?? '')).toLowerCase();
  if (cols.includes('phone_normalized')) return 'This phone number is already registered on another account.';
  if (cols.includes('tagnumber') || cols.includes('tag_number')) {
    return 'That tag number is already used on this farm. Choose a different tag.';
  }
  if (cols.includes('usagedate') || cols.includes('usage_date')) {
    return 'Daily feed usage is already logged for that date.';
  }
  if (cols.includes('farmid') && cols.includes('name')) return 'A pen with this name already exists on this farm.';
  return 'A record with this value already exists.';
}
