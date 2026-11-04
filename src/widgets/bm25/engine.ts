/** Okapi BM25 over a small in-memory corpus. Pure, with no DOM or project dependencies. */
export interface Bm25Doc {
  id: string
  /** Everything that is indexed for this document. */
  text: string
}
export interface Bm25Hit {
  index: number
  score: number
  /** Query terms found in this document. */
  matched: string[]
}
export interface Posting {
  term: string
  df: number
  idf: number
  docs: { index: number; tf: number }[]
}

export const K1 = 1.2
export const B = 0.75
const STOP = new Set('to your the then and or is are a an of in on at can be if that when you my me i it this for with'.split(' '))

/** Lower-case, keep letters, digits and hyphens in any script, drop stop words, strip a plural "s". */
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\- ]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => w.replace(/s$/, ''))
    .filter(Boolean)
}

export interface Bm25Index {
  docs: string[][]
  n: number
  avgdl: number
  df: Map<string, number>
}

export function buildIndex(docs: Bm25Doc[]): Bm25Index {
  const toks = docs.map((d) => tokenize(d.text))
  const df = new Map<string, number>()
  toks.forEach((d) => new Set(d).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1)))
  const total = toks.reduce((s, d) => s + d.length, 0)
  return { docs: toks, n: toks.length, avgdl: toks.length ? total / toks.length : 0, df }
}

export const idf = (ix: Bm25Index, term: string) => {
  const nq = ix.df.get(term) ?? 0
  return Math.log(1 + (ix.n - nq + 0.5) / (nq + 0.5))
}

/** Every document, best first. Ties keep corpus order, so a zero-score tail is stable. */
export function search(ix: Bm25Index, query: string): Bm25Hit[] {
  const terms = [...new Set(tokenize(query))]
  return ix.docs
    .map((d, index) => {
      let score = 0
      const matched: string[] = []
      for (const t of terms) {
        const f = d.filter((x) => x === t).length
        if (!f) continue
        score += (idf(ix, t) * f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.length) / ix.avgdl))
        matched.push(t)
      }
      return { index, score, matched }
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
}

/** The inverted-index entry for each query term. */
export function postings(ix: Bm25Index, query: string): Posting[] {
  return [...new Set(tokenize(query))].map((term) => ({
    term,
    df: ix.df.get(term) ?? 0,
    idf: idf(ix, term),
    docs: ix.docs.flatMap((d, index) => {
      const tf = d.filter((x) => x === term).length
      return tf ? [{ index, tf }] : []
    }),
  }))
}
