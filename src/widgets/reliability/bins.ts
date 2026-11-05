/** Illustrative reliability diagrams: observed frequency in each of ten confidence bins. Pure. */
export interface Bin {
  predicted: number
  observed: number
  /** Far enough from the diagonal to call it miscalibrated. */
  off: boolean
}

const OFF_BY = 0.08
const makeBins = (observed: (p: number) => number): Bin[] =>
  Array.from({ length: 10 }, (_, i) => {
    const predicted = (i + 0.5) / 10
    const o = observed(predicted)
    return { predicted, observed: o, off: Math.abs(o - predicted) > OFF_BY }
  })

export const OVERCONFIDENT = makeBins((p) => Math.pow(p, 1.7) * 0.95 + 0.02)
export const CALIBRATED = makeBins((p) => Math.max(0.01, Math.min(0.99, p + (((p * 100) % 7) - 3) / 200)))

/** Expected calibration error, counting each bin equally. */
export const ece = (bins: Bin[]) => bins.reduce((s, b) => s + Math.abs(b.observed - b.predicted), 0) / bins.length
