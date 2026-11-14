export type Decay = 'cosine' | 'linear' | 'constant' | 'step'
export const DECAYS: Decay[] = ['cosine', 'linear', 'constant', 'step']
export const STEPS = 10000

/** Learning rate at fraction `t` (0 to 1) of training: linear warm-up to `peak`, then decay down to a tenth of it. */
export function learningRate(t: number, peak: number, warmup: number, kind: Decay): number {
  const floor = peak * 0.1
  if (t < warmup) return (peak * t) / Math.max(warmup, 1e-9)
  const q = (t - warmup) / Math.max(1 - warmup, 1e-9)
  if (kind === 'cosine') return floor + 0.5 * (peak - floor) * (1 + Math.cos(Math.PI * q))
  if (kind === 'linear') return peak - (peak - floor) * q
  if (kind === 'step') return peak * (t < 0.6 ? 1 : t < 0.85 ? 0.3 : 0.09)
  return peak
}
