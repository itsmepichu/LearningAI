/** What prefix caching does to first-token time and input cost. Pure. */
export interface PrefixInputs {
  prefixTokens: number
  uniqueTokens: number
  hitRate: number
  /** Prefill speed, in tokens per second. */
  speed: number
  /** Dollars per million input tokens. */
  price: number
  /** The share of the price taken off cached tokens. */
  discount: number
}

/** Queueing and the first decode step. */
const FIXED_S = 0.08

export function prefixCost(i: PrefixInputs) {
  const ttftHit = FIXED_S + i.uniqueTokens / i.speed
  const ttftMiss = FIXED_S + (i.prefixTokens + i.uniqueTokens) / i.speed
  const costHit = ((i.prefixTokens * (1 - i.discount) + i.uniqueTokens) / 1e6) * i.price
  const costMiss = ((i.prefixTokens + i.uniqueTokens) / 1e6) * i.price
  const cost = i.hitRate * costHit + (1 - i.hitRate) * costMiss
  return {
    ttftHit,
    ttftMiss,
    ttftAverage: i.hitRate * ttftHit + (1 - i.hitRate) * ttftMiss,
    costPerThousand: cost * 1000,
    saving: costMiss ? 1 - cost / costMiss : 0,
  }
}
