/**
 * 9.3: documents as points in a vector space. Each of the project's labelled messages becomes a vector, either word
 * counts weighted by rarity (TF-IDF, computed here, no download) or a sentence embedding (after the reader opts in).
 * PCA projects the vectors to three axes, which the scene draws, and the text says how much of the spread those three
 * axes keep. Nearest neighbours are found in the full space, not in the picture. Pure.
 */
import { tokenize } from '../bm25/engine.ts'
import type { Example } from '../text-classifier/examples.ts'
import { seeded } from '../scene3d/tensor.ts'
import type { PointView, SceneStep, Tone, Vec3 } from '../scene3d/tensor.ts'

export type Vectors = number[][]

/** TF-IDF over words that occur in at least two texts, each vector scaled to length 1. */
export function tfidf(texts: string[]): { vectors: Vectors; vocabulary: string[] } {
  const docs = texts.map((t) => tokenize(t))
  const df = new Map<string, number>()
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) ?? 0) + 1)
  const vocabulary = [...df.entries()].filter(([, n]) => n >= 2).map(([w]) => w).sort()
  const index = new Map(vocabulary.map((w, i) => [w, i]))
  const n = texts.length
  const vectors = docs.map((d) => {
    const v = new Array<number>(vocabulary.length).fill(0)
    for (const w of d) {
      const i = index.get(w)
      if (i !== undefined) v[i] += 1
    }
    for (let i = 0; i < v.length; i++) if (v[i]) v[i] *= Math.log(n / df.get(vocabulary[i])!)
    return unit(v)
  })
  return { vectors, vocabulary }
}

export function unit(v: number[]): number[] {
  const len = Math.hypot(...v)
  return len ? v.map((x) => x / len) : v
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

export interface Projection {
  /** Each row's position on the first three principal components. */
  coords: Vec3[]
  /** The share of the total variance each component keeps. */
  explained: [number, number, number]
}

/** The first three principal components, by power iteration with deflation. Seeded, so the same input gives the same axes. */
export function pca3(vectors: Vectors, iterations = 40): Projection {
  const n = vectors.length
  const d = vectors[0].length
  const mean = new Array<number>(d).fill(0)
  for (const v of vectors) for (let j = 0; j < d; j++) mean[j] += v[j] / n
  const x = vectors.map((v) => v.map((val, j) => val - mean[j]))
  const total = x.reduce((s, row) => s + row.reduce((t, v) => t + v * v, 0), 0) / n
  const r = seeded(97)
  const comps: number[][] = []
  const explained: number[] = []
  for (let k = 0; k < 3; k++) {
    let v = unit(Array.from({ length: d }, () => r() - 0.5))
    let lambda = 0
    for (let it = 0; it < iterations; it++) {
      const xv = x.map((row) => row.reduce((s, val, j) => s + val * v[j], 0))
      const next = new Array<number>(d).fill(0)
      for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) next[j] += x[i][j] * xv[i]
      for (const c of comps) {
        const dot = next.reduce((s, val, j) => s + val * c[j], 0)
        for (let j = 0; j < d; j++) next[j] -= dot * c[j]
      }
      lambda = Math.hypot(...next) / n
      v = unit(next)
    }
    comps.push(v)
    explained.push(total ? lambda / total : 0)
  }
  const raw = x.map((row) => comps.map((c) => row.reduce((s, val, j) => s + val * c[j], 0)) as Vec3)
  const reach = Math.max(1e-9, ...raw.flat().map(Math.abs))
  // PC1 across, PC3 up, PC2 towards you: seen from above, the map shows the two biggest components.
  const coords = raw.map(([a, b, c]) => [(a / reach) * 3, (c / reach) * 3, (b / reach) * 3] as Vec3)
  return { coords, explained: explained as [number, number, number] }
}

export interface Neighbour {
  index: number
  similarity: number
}

/** The k most similar rows to row `i`, by cosine in the full space. */
export function neighbours(vectors: Vectors, i: number, k = 5): Neighbour[] {
  return vectors
    .map((v, j) => ({ index: j, similarity: j === i ? -Infinity : cosine(vectors[i], v) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
}

/** How often a row's 5 nearest neighbours share its label, averaged over rows, and what chance would give. */
export function labelAgreement(vectors: Vectors, labels: string[], k = 5) {
  const counts = new Map<string, number>()
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1)
  const n = labels.length
  const chance = [...counts.values()].reduce((s, c) => s + (c / n) * ((c - 1) / (n - 1)), 0)
  let agree = 0
  for (let i = 0; i < n; i++) agree += neighbours(vectors, i, k).filter((nb) => labels[nb.index] === labels[i]).length / k
  return { agreement: agree / n, chance }
}

export const pct = (v: number) => `${Math.round(v * 100)}%`
const short = (s: string, n = 48) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export interface SpaceInput {
  rows: Example[]
  vectors: Vectors
  /** What the vectors are, for the text: "TF-IDF word counts" or the embedding model's name. */
  kind: string
  noun: string
  target: string
  /** Precomputed, since it costs a pass over every pair of rows. */
  agreement: { agreement: number; chance: number }
  projection: Projection
  /** The row to look at closely. */
  focus: number
  labelTones: Map<string, Tone>
}

export function spaceSteps(s: SpaceInput): SceneStep[] {
  const { rows, vectors, projection: pr, focus } = s
  const near = neighbours(vectors, focus)
  const nearSet = new Set(near.map((n) => n.index))
  const kept = pr.explained.reduce((a, b) => a + b, 0)
  const point = (i: number, highlight: boolean, faded: boolean, showFocus: boolean): PointView => ({
    id: rows[i].id,
    at: pr.coords[i],
    tone: s.labelTones.get(rows[i].label)!,
    r: showFocus && i === focus ? 0.14 : highlight ? 0.1 : 0.055,
    label: showFocus && i === focus ? `“${short(rows[i].text, 36)}”` : undefined,
    faded,
  })
  const same = near.filter((n) => rows[n.index].label === rows[focus].label).length
  const overview: SceneStep = {
    title: `${rows.length} ${s.noun} as points`,
    text: `Each point is one of ${rows.length} ${s.noun}, turned into a vector by ${s.kind} (${vectors[0].length} numbers each) and coloured by its ${s.target}. The picture uses the three directions that spread the points most (PCA), which keep ${pct(kept)} of the variance, so much of the structure is flattened away. In the full space, a point's 5 nearest neighbours share its ${s.target} ${pct(s.agreement.agreement)} of the time, against ${pct(s.agreement.chance)} by chance.`,
    tensors: [],
    points: rows.map((_, i) => point(i, false, false, false)),
    target: [0, 0, 0],
    distance: 9,
    map: true,
    table: {
      caption: `How much of the spread each axis keeps (${s.kind})`,
      head: ['Axis', 'Variance kept'],
      rows: [['Across (1st component)', pct(pr.explained[0])], ['Towards you (2nd)', pct(pr.explained[1])], ['Up (3rd)', pct(pr.explained[2])]],
    },
  }
  const q = pr.coords[focus]
  const close: SceneStep = {
    title: `One ${s.noun.replace(/s$/, '')} and its nearest neighbours`,
    text: `The large point is “${short(rows[focus].text, 90)}” (${s.target}: ${rows[focus].label}). Lines join it to its 5 nearest neighbours by cosine similarity in the full ${vectors[0].length}-number space, of which ${same} share its ${s.target}. Some may look far away here: that is the projection, not the search.`,
    tensors: [],
    points: rows.map((_, i) => point(i, nearSet.has(i), i !== focus && !nearSet.has(i), true)),
    paths: near.map((n) => ({ id: `nb-${n.index}`, points: [q, pr.coords[n.index]], tone: 'ink' as Tone, solid: true, width: 1.5 })),
    target: q,
    distance: 6,
    map: true,
    table: {
      caption: `Nearest neighbours of the chosen ${s.noun.replace(/s$/, '')}, in the full space`,
      head: ['Rank', s.target, 'Cosine similarity', 'Text'],
      rows: near.map((n, k) => [k + 1, rows[n.index].label, n.similarity.toFixed(2), short(rows[n.index].text, 80)]),
    },
  }
  return [overview, close]
}
