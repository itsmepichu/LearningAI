/**
 * 9.4: the same HNSW index and search as the 2D figure (hnsw/graph.ts), drawn with its layers stacked, so the third
 * axis is the layer. The search starts on the sparse top layer, hops greedily, drops to the bottom layer and expands
 * from there. Every step is the real search's trace. Pure.
 */
import { buildIndex, queryAt, searchIndex, POINT_COUNT, type HnswIndex, type Links, type Pt } from '../hnsw/graph.ts'
import type { PointView, SceneStep, Segments, Vec3 } from '../scene3d/tensor.ts'

const SPAN = 6
const TOP = 2.4
const at = (p: Pt, y: number): Vec3 => [(p[0] - 0.5) * SPAN, y, (p[1] - 0.5) * SPAN]

function edges(ix: HnswIndex, g: Links, y: number): [Vec3, Vec3][] {
  const out: [Vec3, Vec3][] = []
  for (const [i, ns] of g) for (const j of ns) if (i < j || !g.get(j)?.includes(i)) out.push([at(ix.points[i], y), at(ix.points[j], y)])
  return out
}

/** Bottom-layer expansions beyond this many are merged, so the player stays short. */
const MAX_BOTTOM_STEPS = 6

export function hnswSteps(queryNumber: number): SceneStep[] {
  const ix = buildIndex()
  const query = queryAt(queryNumber)
  const res = searchIndex(ix, query)
  const dist = (i: number) => Math.hypot(ix.points[i][0] - query[0], ix.points[i][1] - query[1])
  const topEdges: Segments = { id: 'top-edges', pairs: edges(ix, ix.upper, TOP), tone: 'accent' }
  const bottomEdges: Segments = { id: 'bottom-edges', pairs: edges(ix, ix.bottom, 0), tone: 'muted' }

  // Replay the trace into states: the top-layer path, where it dropped, and what the bottom layer visited.
  const upperPath: number[] = []
  let dropAt: number | null = null
  const visited: number[] = []
  const bottomMoves: [number, number][] = []
  let computed = 0
  interface State { title: string; text: string; upper: number[]; drop: number | null; visited: number[]; moves: [number, number][]; current: number | null; computed: number }
  const states: State[] = []
  const entry = ix.upperIds[0]
  upperPath.push(entry)
  computed = 1
  states.push({ title: 'Two layers of the same points', text: '', upper: [], drop: null, visited: [], moves: [], current: null, computed: 0 })
  states.push({ title: 'Start at the entry point, on the top layer', text: '', upper: [entry], drop: null, visited: [], moves: [], current: entry, computed })
  const bottomTrace = res.trace.filter((t) => t.layer === 0)
  const chunk = Math.max(1, Math.ceil(bottomTrace.length / MAX_BOTTOM_STEPS))
  let bottomSeen = 0
  for (const t of res.trace) {
    if (t.layer === 1) {
      upperPath.push(t.to)
      computed += 1
      states.push({ title: `Hop to a closer point on the top layer (${upperPath.length - 1})`, text: '', upper: [...upperPath], drop: null, visited: [], moves: [], current: t.to, computed })
    } else if (t.layer === 'down') {
      dropAt = t.at
      visited.push(t.at)
      states.push({ title: 'Drop to the bottom layer', text: '', upper: [...upperPath], drop: dropAt, visited: [...visited], moves: [], current: t.at, computed })
    } else {
      for (const a of t.to) {
        visited.push(a)
        bottomMoves.push([t.from, a])
      }
      computed = t.computed
      bottomSeen++
      if (bottomSeen % chunk === 0 || bottomSeen === bottomTrace.length)
        states.push({ title: `Expand the closest candidates on the bottom layer (${Math.ceil(bottomSeen / chunk)})`, text: '', upper: [...upperPath], drop: dropAt, visited: [...visited], moves: [...bottomMoves], current: t.from, computed })
    }
  }
  const found = res.found
  const exact = res.exact

  const textFor = (s: State, i: number): string => {
    if (i === 0)
      return `${POINT_COUNT} points sit on the bottom layer, each linked to its nearest neighbours. Every 10th point is also on the top layer (${ix.upperIds.length} points), with fewer, longer links. The layers are the third axis: the top layer gets close fast, the bottom layer gets close exactly. The red point marks the query on both layers.`
    if (i === 1) return `The search starts at a fixed entry point on the top layer. It has computed ${s.computed} distance so far.`
    if (s.drop === null) return `It checks the current point's top-layer neighbours and moves to one closer to the query: now ${dist(s.current!).toFixed(3)} away. ${s.computed} distances so far.`
    if (s.moves.length === 0) return `No top-layer neighbour is closer, so the search drops straight down to the same point on the bottom layer, where links are short and dense.`
    const done = i === states.length - 1
    return done
      ? `The search stops when no candidate can improve on its 6 best. It returns point ${found}${found === exact ? ', which is the true nearest neighbour' : `, while the true nearest is point ${exact}: approximate search can miss`}, after ${s.computed} distance computations instead of ${POINT_COUNT} for an exact scan.`
      : `It expands the closest candidates, computing the distance to their unvisited neighbours and keeping the best: ${s.visited.length} points visited and ${s.computed} distances so far.`
  }

  return states.map((s, i): SceneStep => {
    const visitedSet = new Set(s.visited)
    const pathSet = new Set(s.upper)
    const done = i === states.length - 1
    const points: PointView[] = [
      ...ix.points.map((p, j): PointView => ({
        id: `b${j}`,
        at: at(p, 0),
        tone: done && j === found ? 'ok' : j === s.current && s.drop !== null ? 'sim' : visitedSet.has(j) ? 'signal' : 'muted',
        r: (done && j === found) || (j === s.current && s.drop !== null) ? 0.1 : visitedSet.has(j) ? 0.07 : 0.045,
        label: done && j === found ? `found: point ${found}` : undefined,
      })),
      ...ix.upperIds.map((j): PointView => ({
        id: `u${j}`,
        at: at(ix.points[j], TOP),
        tone: pathSet.has(j) ? (j === s.current && s.drop === null ? 'sim' : 'signal') : 'accent',
        r: pathSet.has(j) ? 0.09 : 0.065,
        faded: s.drop !== null && !pathSet.has(j),
      })),
      { id: 'q-top', at: at(query, TOP), tone: 'bad', r: 0.1, label: i === 0 ? 'query' : undefined },
      { id: 'q-bottom', at: at(query, 0), tone: 'bad', r: 0.1 },
    ]
    const paths = [
      ...(s.upper.length > 1 ? [{ id: 'top-path', points: s.upper.map((j) => at(ix.points[j], TOP)), tone: 'signal' as const, solid: true, width: 3 }] : []),
      ...(s.drop !== null ? [{ id: 'drop', points: [at(ix.points[s.drop], TOP), at(ix.points[s.drop], 0)], tone: 'signal' as const, width: 2, label: 'down a layer' }] : []),
      ...s.moves.map(([a, b]) => ({ id: `m${a}-${b}`, points: [at(ix.points[a], 0), at(ix.points[b], 0)], tone: 'signal' as const, solid: true, width: 2 })),
    ]
    return {
      title: s.title,
      text: textFor(s, i),
      tensors: [],
      points,
      paths,
      segments: [{ ...topEdges, faded: s.drop !== null }, { ...bottomEdges, faded: s.drop === null && i > 0 }],
      notes: i === 0 ? [{ id: 'top', at: [-SPAN / 2 - 0.4, TOP, -SPAN / 2], text: 'top layer' }, { id: 'bottom', at: [-SPAN / 2 - 0.4, 0, -SPAN / 2], text: 'bottom layer' }] : [],
      target: s.drop === null ? [0, TOP * 0.6, 0] : [0, 0.4, 0],
      distance: 9.5,
      map: true,
      table: {
        caption: 'The search so far',
        head: ['Layer', 'Path or points visited'],
        rows: [
          ['Top', s.upper.length ? s.upper.join(' → ') : '—'],
          ['Bottom', s.visited.length ? `${s.visited.length} points, ending at ${s.current ?? '—'}` : '—'],
          ['Distances computed', `${s.computed} of ${POINT_COUNT}`],
        ],
      },
    }
  })
}

