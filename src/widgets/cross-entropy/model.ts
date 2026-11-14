export const LABELS = ['yes', 'no', 'maybe'] as const

const normalise = (v: number[]): number[] => {
  const s = v.reduce((a, b) => a + b, 0)
  return s ? v.map((x) => x / s) : v.map(() => 1 / v.length)
}

/** Entropy of p, cross-entropy of p against q, KL divergence and perplexity, all in nats. `pRaw` and `qRaw` are slider values. */
export function information(pRaw: number[], qRaw: number[]) {
  const p = normalise(pRaw)
  const q = normalise(qRaw)
  const entropy = -p.reduce((s, v) => s + (v > 0 ? v * Math.log(v) : 0), 0)
  const cross = -p.reduce((s, v, i) => s + (v > 0 ? v * Math.log(q[i]) : 0), 0)
  return { p, q, entropy, cross, kl: cross - entropy, perplexity: Math.exp(cross) }
}
