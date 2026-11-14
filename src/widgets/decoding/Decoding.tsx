import { useMemo, useState } from 'react'
import { BarList, Slider, Widget, fmt } from '../kit'
import { TOKENS, candidates, sample } from './sampling'

export default function Decoding() {
  const [temp, setTemp] = useState(100)
  const [k, setK] = useState(10)
  const [top, setTop] = useState(100)
  const [draws, setDraws] = useState<[string, number][] | null>(null)
  const c = useMemo(() => candidates(temp / 100, k, top / 100), [temp, k, top])
  const run = () => setDraws(sample(c, 20, Math.random))
  return (
    <Widget name="decoding">
      <p style={{ fontSize: '.9rem' }}>The next token after &quot;The quarterly results were …&quot;. The scores (logits) are illustrative.</p>
      <div className="row2">
        <Slider label="Temperature" value={temp} min={5} max={200} onChange={(v) => { setTemp(v); setDraws(null) }} format={(v) => fmt(v / 100, 2)} />
        <Slider label="Top-k" value={k} min={1} max={10} onChange={(v) => { setK(v); setDraws(null) }} />
        <Slider label="Top-p" value={top} min={10} max={100} onChange={(v) => { setTop(v); setDraws(null) }} format={(v) => fmt(v / 100, 2)} />
      </div>
      <BarList
        max={100}
        items={c.map((d) => ({
          label: TOKENS[d.index],
          value: (d.after || d.before) * 100,
          color: d.after ? undefined : 'var(--bad)',
          text: d.after ? `${fmt(d.after * 100, 1)}%` : `excluded (${fmt(d.before * 100, 1)}% before)`,
        }))}
      />
      <div className="ctl">
        <button type="button" className="btn primary" onClick={run}>Sample 20 times</button>
      </div>
      {draws && (
        <>
          <div>{draws.map(([t, n]) => <span className="chip" key={t}>{t} ×{n}</span>)}</div>
          <div className="out" aria-live="polite">{draws.length} distinct continuations in 20 samples</div>
        </>
      )}
    </Widget>
  )
}
