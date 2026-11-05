/** Seeded random numbers, so a simulated figure gives the same result for the same seed. Pure. */
export function mulberry(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A standard normal sample, by the Box-Muller transform. */
export function gauss(r: () => number): number {
  let u = 0
  let v = 0
  while (!u) u = r()
  while (!v) v = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** An exponential sample with the given mean, for random arrivals and service times. */
export const exponential = (r: () => number, mean: number) => -Math.log(1 - r()) * mean
