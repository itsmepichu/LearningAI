/** Vector search over small in-memory corpora: exact cosine ranking and two quantisation schemes. Pure. */
export type Vec = ArrayLike<number>

export function dot(a: Vec, b: Vec): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

export function cosine(a: Vec, b: Vec): number {
  const denom = Math.sqrt(dot(a, a) * dot(b, b))
  return denom ? dot(a, b) / denom : 0
}

export interface Hit {
  id: string
  score: number
}

/** Every document against the query, best first: an exact scan, the thing an approximate index approximates. Ties keep corpus order. */
export function exactSearch(ids: string[], vectors: Vec[], query: Vec, limit = ids.length): Hit[] {
  return ids
    .map((id, i) => ({ id, i, score: cosine(vectors[i], query) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map(({ id, score }) => ({ id, score }))
}

/** One signed byte per dimension, with one scale for the whole corpus so that codes stay comparable. */
export function scalarQuantizer(vectors: Vec[]): (v: Vec) => Int8Array {
  let peak = 0
  for (const v of vectors) for (let i = 0; i < v.length; i++) peak = Math.max(peak, Math.abs(v[i]))
  const scale = peak ? 127 / peak : 1
  return (v) => {
    const out = new Int8Array(v.length)
    for (let i = 0; i < v.length; i++) out[i] = Math.max(-127, Math.min(127, Math.round(v[i] * scale)))
    return out
  }
}

/** One bit per dimension: its sign. */
export function binaryCode(v: Vec): Uint8Array {
  const out = new Uint8Array(Math.ceil(v.length / 8))
  for (let i = 0; i < v.length; i++) if (v[i] > 0) out[i >> 3] |= 1 << (i & 7)
  return out
}

export function hamming(a: Uint8Array, b: Uint8Array): number {
  let bits = 0
  for (let i = 0; i < a.length; i++) {
    let x = a[i] ^ b[i]
    while (x) {
      x &= x - 1
      bits++
    }
  }
  return bits
}

/** The share of the exact top k that an approximate list also has in its top k. */
export function recallAgainst(exact: string[], approx: string[], k: number): number {
  const want = exact.slice(0, k)
  if (!want.length) return 0
  const got = new Set(approx.slice(0, k))
  return want.filter((id) => got.has(id)).length / want.length
}

export interface QuantRow {
  id: 'float32' | 'int8' | 'binary' | 'binary+rescore'
  label: string
  bytesPerVector: number
  /** Mean recall@k against the exact float32 ranking, over the query set. */
  recall: number
}

/**
 * How much of the exact top k each smaller code keeps. `binary+rescore` finds 3k candidates by Hamming distance and
 * re-scores only those with the full vectors, as production indexes do; it still stores the float32 vectors.
 */
export function quantisationReport(ids: string[], vectors: Vec[], queries: Vec[], k: number): QuantRow[] {
  const dims = vectors[0]?.length ?? 0
  const toInt8 = scalarQuantizer(vectors)
  const int8 = vectors.map(toInt8)
  const binary = vectors.map(binaryCode)
  const totals = { int8: 0, binary: 0, rescore: 0 }
  const order = (scored: { i: number; s: number }[], dir: 1 | -1) => scored.sort((a, b) => dir * (a.s - b.s) || a.i - b.i)
  for (const q of queries) {
    const exact = exactSearch(ids, vectors, q).map((h) => h.id)
    const qi = toInt8(q)
    const byInt8 = order(int8.map((v, i) => ({ i, s: cosine(v, qi) })), -1).map((x) => ids[x.i])
    const qb = binaryCode(q)
    const byBits = order(binary.map((v, i) => ({ i, s: hamming(v, qb) })), 1)
    const pool = byBits.slice(0, k * 3).map((x) => x.i)
    const rescored = order(pool.map((i) => ({ i, s: cosine(vectors[i], q) })), -1).map((x) => ids[x.i])
    totals.int8 += recallAgainst(exact, byInt8, k)
    totals.binary += recallAgainst(exact, byBits.map((x) => ids[x.i]), k)
    totals.rescore += recallAgainst(exact, rescored, k)
  }
  const mean = (t: number) => (queries.length ? t / queries.length : 0)
  return [
    { id: 'float32', label: 'float32, the exact scan', bytesPerVector: dims * 4, recall: 1 },
    { id: 'int8', label: 'int8 scalar', bytesPerVector: dims, recall: mean(totals.int8) },
    { id: 'binary', label: 'binary', bytesPerVector: Math.ceil(dims / 8), recall: mean(totals.binary) },
    { id: 'binary+rescore', label: `binary, re-scoring the top ${k * 3} with float32`, bytesPerVector: Math.ceil(dims / 8) + dims * 4, recall: mean(totals.rescore) },
  ]
}
