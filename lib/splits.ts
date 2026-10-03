/**
 * Integer split of credit amounts. `remainderTo` takes the rounding remainder,
 * so the parts always add up exactly to the input.
 */
export function splitByPercent<K extends string>(
  amount: bigint,
  pcts: Record<K, number>,
  remainderTo: NoInfer<K>,
): Record<K, bigint> {
  const keys = Object.keys(pcts) as K[];
  const out = {} as Record<K, bigint>;
  let assigned = 0n;
  for (const k of keys) {
    if (k === remainderTo) continue;
    out[k] = (amount * BigInt(Math.round(pcts[k] * 100))) / 10_000n;
    assigned += out[k];
  }
  out[remainderTo] = amount - assigned;
  return out;
}

/**
 * Splits an amount in proportion to integer weights.
 * Floors each share and gives the rounding remainder to the largest weight, so the
 * shares always add up exactly.
 */
export function splitByWeight(amount: bigint, weights: bigint[]): bigint[] {
  const total = weights.reduce((a, b) => a + b, 0n);
  if (total === 0n) return weights.map(() => 0n);
  const shares = weights.map((w) => (amount * w) / total);
  const remainder = amount - shares.reduce((a, b) => a + b, 0n);
  const largest = weights.indexOf(weights.reduce((a, b) => (b > a ? b : a)));
  shares[largest] += remainder;
  return shares;
}
