import { useState } from 'react'
import { Widget } from '../kit'
import { GRADS, LABELS, LR, W0, state } from './step'

export default function DataParallel() {
  const [s, setS] = useState(0)
  const { sum, avg, w } = state(s)
  return (
    <Widget name="data-parallel">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10 }}>
        {GRADS.map((g, i) => (
          <div key={i} className="card" style={{ textAlign: 'center', ...(s === 1 ? { borderColor: 'var(--signal)' } : null) }}>
            <b style={{ fontSize: '.85rem' }}>Worker {i + 1}</b>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: '.8rem', marginTop: 6 }}>w = {w.toFixed(2)}</div>
            <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>batch {i * 8 + 1}–{i * 8 + 8}</div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: '.8rem', marginTop: 4, color: 'var(--signal)' }}>{s >= 1 ? `∇ = ${g.toFixed(2)}` : '∇ = ?'}</div>
            {s >= 3 && <div style={{ fontFamily: 'var(--f-mono)', fontSize: '.78rem', color: 'var(--accent)' }}>avg = {avg.toFixed(2)}</div>}
          </div>
        ))}
      </div>
      {s === 2 && <div className="out" style={{ marginTop: 8, textAlign: 'center' }}>ring all-reduce: {GRADS.map((g) => g.toFixed(2)).join(' + ')} = {sum.toFixed(2)} (every worker receives the sum)</div>}
      {s >= 4 && <div className="out" style={{ marginTop: 8, textAlign: 'center' }}>w ← {W0.toFixed(2)} − {LR} × {avg.toFixed(2)} = {w.toFixed(2)} on all four workers: the replicas are still identical</div>}
      <div className="ctl">
        <button type="button" className="btn primary" onClick={() => setS((v) => Math.min(4, v + 1))} disabled={s >= 4}>Next stage</button>
        <button type="button" className="btn" onClick={() => setS(0)} disabled={s === 0}>Reset</button>
        <span className="count" aria-live="polite">Stage {s + 1} of 5 · {LABELS[s]}</span>
      </div>
    </Widget>
  )
}
