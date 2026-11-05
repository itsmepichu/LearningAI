/** A roofline-style model of decode: each step is limited by memory or by compute. Illustrative constants. Pure. */
export const MAX_BATCH = 256
export const ITL_SLO_MS = 50
export const ITL_AXIS_MS = 80

/** Decode step time in milliseconds, which is also each user's inter-token latency. */
export const stepMs = (batch: number) => Math.max(4.8 + 0.24 * batch, 0.032 * batch) + 1

export const throughput = (batch: number) => (batch / stepMs(batch)) * 1000
export const perUserSpeed = (batch: number) => 1000 / stepMs(batch)

/** The largest batch whose latency still meets the target. */
export function bestUnderSlo(slo = ITL_SLO_MS): number {
  let best = 1
  for (let b = 1; b <= MAX_BATCH; b++) if (stepMs(b) <= slo) best = b
  return best
}
