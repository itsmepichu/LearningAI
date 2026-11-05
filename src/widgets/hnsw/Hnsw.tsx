import { useCallback, useEffect, useMemo, useState } from 'react'
import { Legend, ThemeCanvas, Widget, fmt, useReducedMotion, type CanvasFrame } from '../kit'
import { POINT_COUNT, buildIndex, queryAt, searchIndex, type Links, type Pt } from './graph'

const STEP_MS = 160

export default function Hnsw() {
  const index = useMemo(() => buildIndex(), [])
  const [queryNo, setQueryNo] = useState(0)
  const result = useMemo(() => searchIndex(index, queryAt(queryNo)), [index, queryNo])
  const total = result.trace.length
  const [shown, setShown] = useState(Infinity)
  const [playing, setPlaying] = useState(false)
  const reduced = useReducedMotion()
  const pos = Math.min(shown, total)
  const done = pos >= total

  useEffect(() => {
    if (!playing) return
    if (done) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setShown((s) => Math.min(s, total) + 1), STEP_MS)
    return () => clearTimeout(t)
  }, [playing, done, shown, total])

  const search = () => {
    setQueryNo((n) => n + 1)
    if (reduced) {
      setShown(Infinity)
    } else {
      setShown(0)
      setPlaying(true)
    }
  }
  const step = () => {
    setPlaying(false)
    if (done) {
      setQueryNo((n) => n + 1)
      setShown(0)
    } else setShown(pos + 1)
  }

  const draw = useCallback(
    ({ ctx, width, height, tokens }: CanvasFrame) => {
      const paneHeight = (height - 44) / 2
      const pane = (layer: 0 | 1) => (layer === 1 ? { x: 20, y: 22, w: width - 40, h: paneHeight * 0.85 } : { x: 20, y: 44 + paneHeight * 0.85, w: width - 40, h: paneHeight * 1.15 })
      const at = (p: Pt, layer: 0 | 1): [number, number] => {
        const b = pane(layer)
        return [b.x + p[0] * b.w, b.y + p[1] * b.h]
      }
      const panel = (layer: 0 | 1, title: string, links: Links, ids: number[]) => {
        const b = pane(layer)
        ctx.fillStyle = tokens.muted
        ctx.fillText(title, b.x, b.y - 6)
        ctx.fillStyle = tokens.sunk
        ctx.fillRect(b.x, b.y, b.w, b.h)
        ctx.strokeStyle = tokens.rule
        ctx.lineWidth = 0.6
        for (const i of ids) {
          for (const j of links.get(i)!) {
            if (j <= i) continue
            ctx.beginPath()
            ctx.moveTo(...at(index.points[i], layer))
            ctx.lineTo(...at(index.points[j], layer))
            ctx.stroke()
          }
        }
        ctx.fillStyle = tokens.muted
        for (const i of ids) {
          const [x, y] = at(index.points[i], layer)
          ctx.beginPath()
          ctx.arc(x, y, layer ? 3.5 : 2, 0, 7)
          ctx.fill()
        }
      }
      panel(1, `Upper layer (${index.upperIds.length} nodes, long links)`, index.upper, index.upperIds)
      panel(0, `Bottom layer (all ${POINT_COUNT} nodes)`, index.bottom, index.points.map((_, i) => i))

      ctx.lineWidth = 2.2
      for (const t of result.trace.slice(0, pos)) {
        ctx.beginPath()
        if (t.layer === 1) {
          ctx.strokeStyle = tokens.signal
          ctx.moveTo(...at(index.points[t.from], 1))
          ctx.lineTo(...at(index.points[t.to], 1))
        } else if (t.layer === 'down') {
          ctx.strokeStyle = tokens.sim
          ctx.setLineDash([4, 4])
          ctx.moveTo(...at(index.points[t.at], 1))
          ctx.lineTo(...at(index.points[t.at], 0))
        } else {
          ctx.strokeStyle = tokens.accent
          for (const e of t.to) {
            ctx.moveTo(...at(index.points[t.from], 0))
            ctx.lineTo(...at(index.points[e], 0))
          }
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.fillStyle = tokens.bad
      ctx.font = `18px ${tokens.fontBody}`
      for (const layer of [1, 0] as const) {
        const [x, y] = at(result.query, layer)
        ctx.fillText('★', x - 7, y + 6)
      }
      if (done) {
        const [x, y] = at(index.points[result.found], 0)
        ctx.strokeStyle = tokens.ok
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(x, y, 7, 0, 7)
        ctx.stroke()
      }
    },
    [index, result, pos, done],
  )

  const exact = result.found === result.exact
  return (
    <Widget name="hnsw">
      <Legend
        items={[
          { name: 'Hops on the upper layer', color: 'var(--signal)' },
          { name: 'Descent', color: 'var(--sim)' },
          { name: 'Expansion on the bottom layer', color: 'var(--accent)' },
          { name: 'Query (star)', color: 'var(--bad)' },
          { name: 'Result (ring)', color: 'var(--ok)' },
        ]}
      />
      <ThemeCanvas
        height={400}
        draw={draw}
        label={`Layered search on ${POINT_COUNT} random points. ${exact ? 'It found the exact nearest neighbour' : 'It found a near neighbour'} using ${result.computed} distance computations.`}
      />
      <div className="ctl">
        <button type="button" className="btn primary" onClick={search}>
          Search (new query)
        </button>
        <button type="button" className="btn" onClick={step}>
          Step
        </button>
        <span className="count" aria-live="polite">
          {done ? `${exact ? 'Found the exact nearest neighbour' : 'Found a near neighbour (approximate result)'}. ${fmt(result.computed)} distance computations, against ${POINT_COUNT} for brute force.` : `Step ${pos} of ${total}`}
        </span>
      </div>
    </Widget>
  )
}
