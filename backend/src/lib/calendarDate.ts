const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * True for a date string later than today. Allows one day of slack so a farmer ahead
 * of the server's timezone can still enter their own "today".
 */
export function isFutureCalendarDate(value: string | null | undefined): boolean {
  if (!value) return false;
  const t = new Date(value).getTime();
  return !Number.isNaN(t) && t > Date.now() + ONE_DAY_MS;
}
