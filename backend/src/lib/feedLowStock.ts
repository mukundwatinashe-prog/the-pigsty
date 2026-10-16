/**
 * Feed types at or below the low-stock threshold. Only types the farm has bought count:
 * a feed that was never stocked isn't "running low", and flagging it makes every new
 * farm open with a low-stock warning for all six feed types.
 */
export function lowStockFeedTypes<T extends string>(
  types: readonly T[],
  purchasedKg: Record<T, number>,
  stockKg: Record<T, number>,
  thresholdKg: number,
): T[] {
  return types.filter((t) => purchasedKg[t] > 0 && stockKg[t] <= thresholdKg);
}
