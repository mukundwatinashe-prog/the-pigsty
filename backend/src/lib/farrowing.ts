/** A litter can't wean more piglets than were born alive. */
export function weanedExceedsBornAlive(bornAlive: number, weaned: number | null | undefined): boolean {
  return weaned != null && weaned > bornAlive;
}

/**
 * True when recording this farrowing should end the sow's current service, the same
 * way "Complete birth" does. A farrowing dated before the current service date belongs
 * to an earlier litter and leaves the current service untouched.
 */
export function farrowingEndsCurrentService(
  pig: { serviced: boolean; servicedDate: Date | null },
  farrowingDate: Date,
): boolean {
  if (!pig.serviced) return false;
  if (!pig.servicedDate) return true;
  return farrowingDate.getTime() >= pig.servicedDate.getTime();
}
