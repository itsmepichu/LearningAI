import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { KpiRow, ThemeCanvas, Widget, pct, useReducedMotion, type CanvasFrame } from '../kit'
import { REQUESTS, SLOTS, requestLengths, schedule, utilisation, type Scheduler } from './schedule'

const RUN_MS = 2200

export default function Batching() {
  const id = useId()
  const [mode, setMode] = useState<Scheduler>('continuous')
  const [progress, setProgress] = useState(1)
  const reduced = useReducedMotion()
  const grid = useMemo(() => schedule(mode, requestLengths()), [mode])

  const [runId, setRunId] = useState(0)
  useEffect(() => {
    if (!runId || reduced) {
      setProgress(1)
      return
    }
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / RUN_MS)
      setProgress(p)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [runId, reduced])

  const draw = useCallback(
    ({ ctx, width, tokens }: CanvasFrame) => {
      const colors = [tokens.accent, tokens.signal, tokens.sim, tokens.ok]
      const cell = Math.min(16, (width - 60) / Math.max(grid.length, 60))
      const rowH = 36
      const shown = Math.floor(grid.length * progress)
      ctx.fillStyle = tokens.muted
      ctx.textBaseline = 'middle'
      for (let s = 0; s < SLOTS; s++) ctx.fillText(`slot ${s + 1}`, 4, 8 + s * (rowH + 6) + rowH / 2)
      for (let t = 0; t < shown; t++) {
        grid[t].forEach((v, s) => {
          ctx.fillStyle = v < 0 ? tokens.sunk : colors[v % colors.length]
          ctx.fillRect(50 + t * cell, 8 + s * (rowH + 6), Math.max(1, cell - 1), rowH)
        })
      }
    },
    [grid, progress],
  )

  return (
    <Widget name="batching">
      <div className="ctl">
        <label htmlFor={id}>
          Scheduler
          <select
            id={id}
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as Scheduler)
              setRunId((n) => n + 1)
            }}
          >
            <option value="static">static batching</option>
            <option value="continuous">continuous batching</option>
          </select>
        </label>
        <button type="button" className="btn primary" onClick={() => setRunId((n) => n + 1)}>
          Run
        </button>
      </div>
      <ThemeCanvas
        height={184}
        draw={draw}
        label={`${mode === 'static' ? 'Static' : 'Continuous'} batching finishes ${REQUESTS} requests on ${SLOTS} slots in ${grid.length} decode steps, with ${pct(utilisation(grid))} of slot time busy. Each colour is a request, and colours repeat.`}
      />
      <p className="wk-hint">Each column is one decode step. Each colour is a request (colours repeat), and pale cells are idle slots.</p>
      <KpiRow
        items={[
          { label: `decode steps to finish ${REQUESTS} requests`, value: grid.length },
          { label: 'slot utilisation', value: pct(utilisation(grid)) },
        ]}
      />
    </Widget>
  )
}
