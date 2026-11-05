/** A simplified two-layer HNSW over seeded 2-D points: fixed layers and simple neighbour selection. Pure. */
import { mulberry } from '../kit/random.ts'

export type Pt = [number, number]
export type Links = Map<number, number[]>
export type TraceStep =
  | { layer: 1; from: number; to: number }
  | { layer: 'down'; at: number }
  | { layer: 0; from: number; to: number[]; computed: number }

export const POINT_COUNT = 300
const UPPER_EVERY = 10
const UPPER_LINKS = 3
const BOTTOM_LINKS = 5
const EF = 6

const d2 = (a: Pt, b: Pt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2

function knn(points: Pt[], ids: number[], k: number): Links {
  const g: Links = new Map()
  for (const i of ids) {
    const near = ids.filter((j) => j !== i).sort((a, b) => d2(points[i], points[a]) - d2(points[i], points[b]))
    g.set(i, near.slice(0, k))
  }
  for (const i of ids) for (const j of g.get(i)!) if (!g.get(j)!.includes(i)) g.get(j)!.push(i)
  return g
}

export interface HnswIndex {
  points: Pt[]
  upperIds: number[]
  upper: Links
  bottom: Links
}

export function buildIndex(seed = 21): HnswIndex {
  const r = mulberry(seed)
  const points: Pt[] = Array.from({ length: POINT_COUNT }, () => [r(), r()])
  const all = points.map((_, i) => i)
  const upperIds = all.filter((i) => i % UPPER_EVERY === 0)
  return { points, upperIds, upper: knn(points, upperIds, UPPER_LINKS), bottom: knn(points, all, BOTTOM_LINKS) }
}

export interface SearchResult {
  query: Pt
  trace: TraceStep[]
  found: number
  exact: number
  computed: number
}

/** The n-th query is seeded, so "new query" is repeatable. */
export function queryAt(n: number): Pt {
  const r = mulberry(1000 + n)
  return [r(), r()]
}

export function searchIndex(ix: HnswIndex, query: Pt): SearchResult {
  const { points, upper, bottom, upperIds } = ix
  const dist = (i: number) => d2(points[i], query)
  const trace: TraceStep[] = []
  let ep = upperIds[0]
  let computed = 1
  let improved = true
  while (improved) {
    improved = false
    for (const n of upper.get(ep)!) {
      computed++
      if (dist(n) < dist(ep)) {
        trace.push({ layer: 1, from: ep, to: n })
        ep = n
        improved = true
      }
    }
  }
  trace.push({ layer: 'down', at: ep })
  const worst = (ids: number[]) => ids.reduce((a, b) => (dist(a) > dist(b) ? a : b))
  const visited = new Set([ep])
  const candidates = [ep]
  const results = [ep]
  while (candidates.length) {
    candidates.sort((a, b) => dist(a) - dist(b))
    const c = candidates.shift()!
    if (dist(c) > dist(worst(results)) && results.length >= EF) break
    const added: number[] = []
    for (const e of bottom.get(c)!) {
      if (visited.has(e)) continue
      visited.add(e)
      computed++
      if (results.length < EF || dist(e) < dist(worst(results))) {
        candidates.push(e)
        results.push(e)
        added.push(e)
        if (results.length > EF) results.splice(results.indexOf(worst(results)), 1)
      }
    }
    trace.push({ layer: 0, from: c, to: added, computed })
  }
  const nearest = (ids: number[]) => ids.reduce((a, b) => (dist(a) < dist(b) ? a : b))
  return { query, trace, found: nearest(results), exact: nearest(points.map((_, i) => i)), computed }
}
