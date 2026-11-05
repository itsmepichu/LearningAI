/** A small softmax classifier over fixed feature vectors, with a seeded split and the usual metrics. Pure. */
import { mulberry } from '../kit/random.ts'

export interface Model {
  classes: string[]
  /** One weight row per class; the last column is the bias. */
  weights: number[][]
}

/** The same share of each class goes to training, so a rare class is not left out by chance. Returns row indices. */
export function stratifiedSplit(labels: string[], trainShare: number, seed: number): { train: number[]; test: number[] } {
  const rnd = mulberry(seed)
  const byClass = new Map<string, number[]>()
  labels.forEach((l, i) => byClass.set(l, [...(byClass.get(l) ?? []), i]))
  const train: number[] = []
  const test: number[] = []
  for (const key of [...byClass.keys()].sort()) {
    const rows = byClass.get(key)!
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[rows[i], rows[j]] = [rows[j], rows[i]]
    }
    // A class of two or more keeps at least one row on each side.
    const n = rows.length < 2 ? rows.length : Math.max(1, Math.min(rows.length - 1, Math.round(rows.length * trainShare)))
    train.push(...rows.slice(0, n))
    test.push(...rows.slice(n))
  }
  return { train: train.sort((a, b) => a - b), test: test.sort((a, b) => a - b) }
}

function scores(weights: number[][], x: ArrayLike<number>): number[] {
  return weights.map((w) => {
    let s = w[x.length]
    for (let j = 0; j < x.length; j++) s += w[j] * x[j]
    return s
  })
}

export function softmax(z: number[]): number[] {
  const peak = Math.max(...z)
  const e = z.map((v) => Math.exp(v - peak))
  const sum = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / sum)
}

/** Full-batch gradient descent with L2 on the weights (not the bias). Deterministic, as weights start at zero. */
export function trainSoftmax(x: ArrayLike<number>[], y: string[], { epochs = 300, lr = 1, l2 = 1e-3 } = {}): Model {
  const classes = [...new Set(y)].sort()
  const dims = x[0]?.length ?? 0
  const at = new Map(classes.map((c, i) => [c, i]))
  const weights = classes.map(() => new Array<number>(dims + 1).fill(0))
  const n = x.length
  for (let epoch = 0; epoch < epochs; epoch++) {
    const grad = classes.map(() => new Array<number>(dims + 1).fill(0))
    for (let i = 0; i < n; i++) {
      const p = softmax(scores(weights, x[i]))
      const target = at.get(y[i])!
      for (let c = 0; c < classes.length; c++) {
        const err = p[c] - (c === target ? 1 : 0)
        const g = grad[c]
        for (let j = 0; j < dims; j++) g[j] += err * x[i][j]
        g[dims] += err
      }
    }
    for (let c = 0; c < classes.length; c++) {
      for (let j = 0; j <= dims; j++) {
        const decay = j < dims ? l2 * weights[c][j] : 0
        weights[c][j] -= lr * (grad[c][j] / n + decay)
      }
    }
  }
  return { classes, weights }
}

export const predictProba = (m: Model, x: ArrayLike<number>) => softmax(scores(m.weights, x))

export function predict(m: Model, x: ArrayLike<number>): string {
  const p = predictProba(m, x)
  return m.classes[p.indexOf(Math.max(...p))]
}

export interface ClassRow {
  label: string
  support: number
  precision: number
  recall: number
  f1: number
}
export interface Evaluation {
  accuracy: number
  macroF1: number
  classes: ClassRow[]
  /** `confusion[true][predicted]`, in the order of `labels`. */
  confusion: number[][]
  labels: string[]
}

export function evaluate(truth: string[], predicted: string[]): Evaluation {
  const labels = [...new Set([...truth, ...predicted])].sort()
  const at = new Map(labels.map((c, i) => [c, i]))
  const confusion = labels.map(() => new Array<number>(labels.length).fill(0))
  truth.forEach((t, i) => confusion[at.get(t)!][at.get(predicted[i])!]++)
  const classes = labels.map((label, c) => {
    const tp = confusion[c][c]
    const support = confusion[c].reduce((a, b) => a + b, 0)
    const called = confusion.reduce((sum, row) => sum + row[c], 0)
    const precision = called ? tp / called : 0
    const recall = support ? tp / support : 0
    return { label, support, precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 }
  })
  const right = labels.reduce((sum, _, c) => sum + confusion[c][c], 0)
  // Macro F1 over classes that occur in the truth: a class only ever wrongly predicted should not raise the average.
  const seen = classes.filter((c) => c.support > 0)
  return {
    accuracy: truth.length ? right / truth.length : 0,
    macroF1: seen.length ? seen.reduce((sum, c) => sum + c.f1, 0) / seen.length : 0,
    classes,
    confusion,
    labels,
  }
}

/** What always predicting the most common training class would score: the number a model has to beat. */
export function majorityBaseline(trainLabels: string[], testLabels: string[]): { label: string; accuracy: number } {
  const counts = new Map<string, number>()
  trainLabels.forEach((l) => counts.set(l, (counts.get(l) ?? 0) + 1))
  const label = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? ''
  return { label, accuracy: testLabels.length ? testLabels.filter((l) => l === label).length / testLabels.length : 0 }
}

/** Accuracy per group, such as per language, largest group first. */
export function accuracyBy(groups: string[], truth: string[], predicted: string[]): { group: string; n: number; accuracy: number }[] {
  const out = new Map<string, { n: number; right: number }>()
  groups.forEach((g, i) => {
    const row = out.get(g) ?? { n: 0, right: 0 }
    row.n++
    if (truth[i] === predicted[i]) row.right++
    out.set(g, row)
  })
  return [...out]
    .map(([group, { n, right }]) => ({ group, n, accuracy: right / n }))
    .sort((a, b) => b.n - a.n || a.group.localeCompare(b.group))
}
