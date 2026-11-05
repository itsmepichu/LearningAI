/** Logistic regression trained by gradient descent on seeded synthetic points. Pure and deterministic. */
export interface Point {
  x: number
  y: number
  positive: boolean
}
export type Weights = [number, number, number]

function mulberry(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function gauss(r: () => number) {
  let u = 0
  let v = 0
  while (!u) u = r()
  while (!v) v = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export const POINTS = 800
const ITERATIONS = 1500
const LEARNING_RATE = 1.5

export function makePoints(seed: number, positiveRate: number): Point[] {
  const r = mulberry(seed)
  return Array.from({ length: POINTS }, () => {
    const positive = r() < positiveRate
    return positive
      ? { x: 0.62 + gauss(r) * 0.11, y: 0.6 + gauss(r) * 0.11, positive }
      : { x: 0.42 + gauss(r) * 0.15, y: 0.42 + gauss(r) * 0.15, positive }
  })
}

const zOf = (w: Weights, p: { x: number; y: number }) => w[0] + w[1] * (p.x - 0.5) * 6 + w[2] * (p.y - 0.5) * 6
export const probability = (w: Weights, p: { x: number; y: number }) => 1 / (1 + Math.exp(-zOf(w, p)))

/** Class weighting counts each positive as negatives ÷ positives, so both classes pull equally. */
export function train(points: Point[], classWeights: boolean): Weights {
  const positives = points.filter((p) => p.positive).length
  const weight = classWeights ? (points.length - positives) / Math.max(1, positives) : 1
  const w: Weights = [0, 0, 0]
  for (let it = 0; it < ITERATIONS; it++) {
    const g = [0, 0, 0]
    let total = 0
    for (const p of points) {
      const k = p.positive ? weight : 1
      const e = (probability(w, p) - (p.positive ? 1 : 0)) * k
      g[0] += e
      g[1] += e * (p.x - 0.5) * 6
      g[2] += e * (p.y - 0.5) * 6
      total += k
    }
    for (let j = 0; j < 3; j++) w[j] -= (LEARNING_RATE * g[j]) / total
  }
  return w
}

export function confusion(points: Point[], w: Weights, threshold: number) {
  let tp = 0
  let fp = 0
  let fn = 0
  let tn = 0
  for (const p of points) {
    const flagged = probability(w, p) >= threshold
    if (flagged && p.positive) tp++
    else if (flagged) fp++
    else if (p.positive) fn++
    else tn++
  }
  return {
    tp,
    fp,
    fn,
    tn,
    accuracy: (tp + tn) / points.length,
    recall: tp + fn ? tp / (tp + fn) : 0,
    precision: tp + fp ? tp / (tp + fp) : null,
  }
}

/** The decision boundary's height at a given x, in the same 0 to 1 units as the points. */
export function boundaryY(w: Weights, threshold: number, x: number): number | null {
  if (Math.abs(w[2]) < 1e-6) return null
  const logOdds = Math.log(threshold / (1 - threshold))
  return (logOdds - w[0] - w[1] * (x - 0.5) * 6) / w[2] / 6 + 0.5
}
