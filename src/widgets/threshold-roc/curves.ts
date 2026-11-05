/** Threshold metrics, ROC and precision-recall curves from one seeded set of scores. Pure. */
import { gauss, mulberry } from '../kit/random.ts'

export interface Scored {
  score: number
  positive: boolean
}
export type XY = [number, number]

export const CASES = 400
export const POSITIVES = 80

export function makeScores(seed = 5): Scored[] {
  const r = mulberry(seed)
  return Array.from({ length: CASES }, (_, i) => {
    const positive = i < POSITIVES
    return { score: Math.max(0, Math.min(1, (positive ? 0.66 : 0.38) + gauss(r) * 0.15)), positive }
  })
}

export function confusionAt(scores: Scored[], t: number) {
  let tp = 0
  let fp = 0
  let tn = 0
  let fn = 0
  for (const s of scores) {
    if (s.score >= t) {
      if (s.positive) tp++
      else fp++
    } else if (s.positive) fn++
    else tn++
  }
  return { tp, fp, tn, fn }
}

export function metricsAt(scores: Scored[], t: number) {
  const c = confusionAt(scores, t)
  const precision = c.tp + c.fp ? c.tp / (c.tp + c.fp) : 1
  const recall = c.tp + c.fn ? c.tp / (c.tp + c.fn) : 0
  return {
    ...c,
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    accuracy: (c.tp + c.tn) / scores.length,
    falsePositiveRate: c.fp + c.tn ? c.fp / (c.fp + c.tn) : 0,
  }
}

export function curves(scores: Scored[]) {
  const roc: XY[] = []
  const pr: XY[] = []
  for (let i = 100; i >= 0; i--) {
    const m = metricsAt(scores, i / 100)
    roc.push([m.falsePositiveRate, m.recall])
    if (m.tp + m.fp) pr.push([m.recall, m.precision])
  }
  let auc = 0
  for (let i = 1; i < roc.length; i++) auc += ((roc[i][0] - roc[i - 1][0]) * (roc[i][1] + roc[i - 1][1])) / 2
  return { roc, pr, auc }
}
