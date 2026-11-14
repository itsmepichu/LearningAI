/** A character-level bigram language model: a table of scores, trained by gradient descent on next-character counts. Seeded and pure. */
import { mulberry } from '../kit/random.ts'

export const DEFAULT_CORPUS =
  'the cache stores keys and values. the model reads the cache. the server streams tokens to the user. the user reads the tokens. retries use backoff. the queue holds the jobs. the worker takes the jobs from the queue. the index stores the vectors. the query finds the nearest vectors.'

export interface Bigram {
  vocab: string[]
  index: Map<string, number>
  counts: Float64Array[]
  rows: number[]
  total: number
  floor: number
  weights: Float64Array[]
  steps: number
}

export function build(text: string): Bigram {
  const t = text.toLowerCase()
  const vocab = [...new Set(t)].sort()
  const index = new Map(vocab.map((c, i) => [c, i]))
  const n = vocab.length
  const counts = Array.from({ length: n }, () => new Float64Array(n))
  for (let i = 0; i < t.length - 1; i++) counts[index.get(t[i])!][index.get(t[i + 1])!]++
  const rows = counts.map((r) => r.reduce((a, b) => a + b, 0))
  const total = rows.reduce((a, b) => a + b, 0)
  let floor = 0
  counts.forEach((r, i) => r.forEach((v) => { if (v) floor -= v * Math.log(v / rows[i]) }))
  floor = total ? floor / total : 0
  const m: Bigram = { vocab, index, counts, rows, total, floor, weights: [], steps: 0 }
  reset(m)
  return m
}

export function reset(m: Bigram) {
  const r = mulberry(1)
  const n = m.vocab.length
  m.weights = Array.from({ length: n }, () => Float64Array.from({ length: n }, () => (r() - 0.5) * 0.02))
  m.steps = 0
}

export function probs(m: Bigram, i: number, temperature = 1): number[] {
  const w = m.weights[i]
  const mx = Math.max(...w)
  const e = Array.from(w, (v) => Math.exp((v - mx) / temperature))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

/** Mean cross-entropy, in nats, of the model on every adjacent pair in the corpus. */
export function loss(m: Bigram): number {
  let L = 0
  for (let i = 0; i < m.vocab.length; i++) {
    if (!m.rows[i]) continue
    const p = probs(m, i)
    m.counts[i].forEach((v, j) => { if (v) L -= v * Math.log(p[j]) })
  }
  return m.total ? L / m.total : 0
}

/** Runs `k` full-batch gradient steps and returns the loss every fifth step. */
export function train(m: Bigram, k: number, lr: number): number[] {
  const out: number[] = []
  for (let s = 0; s < k; s++) {
    for (let i = 0; i < m.vocab.length; i++) {
      if (!m.rows[i]) continue
      const p = probs(m, i)
      const w = m.weights[i]
      for (let j = 0; j < m.vocab.length; j++) w[j] -= (lr * (m.rows[i] * p[j] - m.counts[i][j])) / m.total
    }
    m.steps++
    if (s % 5 === 4) out.push(loss(m))
  }
  return out
}

export function generate(m: Bigram, temperature: number, rand: () => number, length = 220): string {
  let c = m.index.get(' ') ?? 0
  let out = ''
  for (let n = 0; n < length; n++) {
    const p = probs(m, c, temperature)
    let u = rand()
    let j = 0
    for (; j < p.length - 1; j++) {
      u -= p[j]
      if (u <= 0) break
    }
    out += m.vocab[j]
    c = j
  }
  return out
}
