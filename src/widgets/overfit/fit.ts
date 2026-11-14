/** Polynomial ridge regression on seeded noisy points: 14 for training, 40 for validation. Pure and deterministic. */
import { gauss, mulberry } from '../kit/random.ts'

export type Pair = [number, number]
export const truth = (x: number) => 0.8 * Math.sin(2 * Math.PI * x) + 0.3 * x

export function makeSets() {
  const r = mulberry(11)
  const train: Pair[] = []
  const valid: Pair[] = []
  for (let i = 0; i < 14; i++) {
    const x = (i + 0.5) / 14 + (r() - 0.5) * 0.03
    train.push([x, truth(x) + gauss(r) * 0.22])
  }
  for (let i = 0; i < 40; i++) {
    const x = r()
    valid.push([x, truth(x) + gauss(r) * 0.22])
  }
  return { train, valid }
}

/** Coefficients of the degree-`degree` polynomial in z = 2x − 1, found by Gauss–Jordan elimination with a ridge penalty `lambda`. */
export function fitPoly(data: Pair[], degree: number, lambda: number): number[] {
  const n = degree + 1
  const A = Array.from({ length: n }, () => Array<number>(n + 1).fill(0))
  for (const [x, y] of data) {
    const z = 2 * x - 1
    const ph = Array.from({ length: n }, (_, k) => z ** k)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i][j] += ph[i] * ph[j]
      A[i][n] += ph[i] * y
    }
  }
  for (let i = 1; i < n; i++) A[i][i] += lambda
  for (let c = 0; c < n; c++) {
    let p = c
    for (let i = c + 1; i < n; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i
    ;[A[c], A[p]] = [A[p], A[c]]
    const v = A[c][c] || 1e-12
    for (let j = c; j <= n; j++) A[c][j] /= v
    for (let i = 0; i < n; i++) {
      if (i === c) continue
      const m = A[i][c]
      for (let j = c; j <= n; j++) A[i][j] -= m * A[c][j]
    }
  }
  return A.map((row) => row[n])
}

export const predict = (w: number[], x: number) => {
  const z = 2 * x - 1
  return w.reduce((s, c, k) => s + c * z ** k, 0)
}
export const mse = (w: number[], data: Pair[]) => data.reduce((a, [x, y]) => a + (predict(w, x) - y) ** 2, 0) / data.length
