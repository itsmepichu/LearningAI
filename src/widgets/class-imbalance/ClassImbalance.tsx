import { useCallback, useId, useMemo, useState } from 'react'
import { DataGate, DataSource, KpiRow, Legend, Slider, ThemeCanvas, Widget, fmt, pct, useProjectData, type CanvasFrame } from '../kit'
import { boundaryY, confusion, makePoints, probability, train } from './model'
import { loadRareClass, type RareClass } from './rates'

const FIXED_RATES = [0.02, 0.05, 0.15]
const PROJECT_RATE = 'project'

function Trainer({ rare }: { rare: RareClass }) {
  const rateId = useId()
  const [choice, setChoice] = useState<string>(PROJECT_RATE)
  const [seed, setSeed] = useState(3)
  const [weighted, setWeighted] = useState(false)
  const [threshold, setThreshold] = useState(0.5)
  const rate = choice === PROJECT_RATE ? rare.rate : +choice
  const points = useMemo(() => makePoints(seed, rate), [seed, rate])
  const weights = useMemo(() => train(points, weighted), [points, weighted])
  const c = confusion(points, weights, threshold)

  const draw = useCallback(
    ({ ctx, width, height, tokens }: CanvasFrame) => {
      const PX = (v: number) => 20 + v * (width - 40)
      const PY = (v: number) => height - 10 - v * (height - 20)
      const dot = (px: number, py: number, r: number) => {
        ctx.beginPath()
        ctx.arc(px, py, r, 0, 7)
      }
      // Negatives first and lighter, so the rare positives stay visible on top.
      ctx.globalAlpha = 0.35
      ctx.fillStyle = tokens.accent
      for (const p of points) {
        if (p.positive) continue
        dot(PX(p.x), PY(p.y), 2.6)
        ctx.fill()
      }
      ctx.globalAlpha = 0.95
      ctx.fillStyle = tokens.bad
      for (const p of points) {
        if (!p.positive) continue
        dot(PX(p.x), PY(p.y), 3.6)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.strokeStyle = tokens.signal
      ctx.lineWidth = 1.2
      for (const p of points) {
        if (probability(weights, p) < threshold) continue
        dot(PX(p.x), PY(p.y), 5)
        ctx.stroke()
      }
      const y0 = boundaryY(weights, threshold, 0)
      const y1 = boundaryY(weights, threshold, 1)
      if (y0 !== null && y1 !== null) {
        ctx.strokeStyle = tokens.ink
        ctx.lineWidth = 2
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(PX(0), PY(y0))
        ctx.lineTo(PX(1), PY(y1))
        ctx.stroke()
        ctx.setLineDash([])
      }
    },
    [points, weights, threshold],
  )

  return (
    <>
      <div className="row2">
        <label htmlFor={rateId}>
          Positive rate
          <select id={rateId} value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value={PROJECT_RATE}>
              {pct(rare.rate, 1)}: {rare.name} in the dataset
            </option>
            {FIXED_RATES.map((r) => (
              <option key={r} value={r}>
                {pct(r)}
              </option>
            ))}
          </select>
        </label>
        <Slider label="Threshold" value={threshold} min={0.05} max={0.95} step={0.01} format={(v) => fmt(v, 2)} onChange={setThreshold} />
        <label>
          <input type="checkbox" checked={weighted} onChange={(e) => setWeighted(e.target.checked)} />
          Class weights
        </label>
        <div className="ctl">
          <button type="button" className="btn" onClick={() => setSeed((s) => s + 1)}>
            New data
          </button>
        </div>
      </div>
      <div>
        <Legend
          items={[
            { name: 'Rare positive class', color: 'var(--bad)' },
            { name: 'Other class', color: 'var(--accent)' },
            { name: 'Ring: predicted positive', color: 'var(--signal)' },
            { name: 'Dashed line: decision boundary', color: 'var(--ink)' },
          ]}
        />
        <ThemeCanvas
          height={300}
          draw={draw}
          label={`${fmt(points.length)} synthetic points, of which ${fmt(c.tp + c.fn)} are positive. At threshold ${fmt(threshold, 2)} the model flags ${fmt(c.tp + c.fp)} points and catches ${pct(c.recall)} of the positives.`}
        />
      </div>
      <KpiRow
        items={[
          { label: 'accuracy', value: pct(c.accuracy, 1) },
          { label: 'recall (rare class)', value: pct(c.recall), tone: c.recall < 0.5 ? 'bad' : c.recall > 0.8 ? 'ok' : 'warn' },
          { label: 'precision', value: c.precision === null ? 'undefined' : pct(c.precision) },
          { label: 'flagged / actual positives', value: `${c.tp + c.fp} / ${c.tp + c.fn}` },
        ]}
      />
    </>
  )
}

export default function ClassImbalance() {
  const state = useProjectData(loadRareClass)
  return (
    <Widget name="class-imbalance">
      <DataGate state={state}>
        {(rare, project) => (
          <>
            <DataSource project={project} files={[rare.file]}>
              The rate is counted from the dataset. The 800 points are synthetic.
            </DataSource>
            <Trainer key={project.id} rare={rare} />
          </>
        )}
      </DataGate>
    </Widget>
  )
}
