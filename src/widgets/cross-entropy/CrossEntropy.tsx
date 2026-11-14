import { useState } from 'react'
import { KpiRow, Slider, Widget, fmt } from '../kit'
import { LABELS, information } from './model'

export default function CrossEntropy() {
  const [p, setP] = useState([100, 0, 0])
  const [q, setQ] = useState([60, 25, 15])
  const r = information(p, q)
  const set = (list: number[], setter: (v: number[]) => void, i: number) => (v: number) => setter(list.map((x, k) => (k === i ? v : x)))
  return (
    <Widget name="cross-entropy">
      <p style={{ fontSize: '.9rem' }}>True distribution p (what actually happens) vs the model&apos;s prediction q over three next tokens.</p>
      <div className="row2">
        <div>
          <b style={{ fontFamily: 'var(--f-display)', fontSize: '.85rem' }}>p (truth)</b>
          {LABELS.map((l, i) => <Slider key={l} label={`"${l}"`} value={p[i]} min={0} max={100} onChange={set(p, setP, i)} />)}
        </div>
        <div>
          <b style={{ fontFamily: 'var(--f-display)', fontSize: '.85rem' }}>q (model)</b>
          {LABELS.map((l, i) => <Slider key={l} label={`"${l}"`} value={q[i]} min={1} max={100} onChange={set(q, setQ, i)} />)}
        </div>
      </div>
      <svg viewBox="0 0 600 120" role="img" aria-label={`Truth p and model q over yes, no and maybe. Cross-entropy ${fmt(r.cross, 3)} nats.`}>
        {LABELS.map((l, i) => {
          const x0 = 40 + i * 190
          return (
            <g key={l}>
              <text x={x0 + 70} y="112" textAnchor="middle" className="sm">&quot;{l}&quot;</text>
              <rect x={x0} y={95 - r.p[i] * 80} width="60" height={r.p[i] * 80} className="fas" style={{ stroke: 'var(--accent)' }} />
              <rect x={x0 + 80} y={95 - r.q[i] * 80} width="60" height={r.q[i] * 80} className="fss" style={{ stroke: 'var(--signal)' }} />
              <text x={x0 + 30} y={90 - r.p[i] * 80} textAnchor="middle" className="xs acc">p {fmt(r.p[i] * 100)}%</text>
              <text x={x0 + 110} y={90 - r.q[i] * 80} textAnchor="middle" className="xs sig">q {fmt(r.q[i] * 100)}%</text>
            </g>
          )
        })}
      </svg>
      <KpiRow
        items={[
          { label: 'entropy H(p)', value: `${fmt(r.entropy, 3)} nats` },
          { label: 'cross-entropy H(p,q) = loss', value: `${fmt(r.cross, 3)} nats`, tone: r.cross > 2 ? 'bad' : r.cross < 0.3 ? 'ok' : undefined },
          { label: 'KL(p‖q) = H(p,q) − H(p)', value: `${fmt(r.kl, 3)} nats` },
          { label: 'perplexity e^H(p,q)', value: fmt(r.perplexity, 2) },
        ]}
      />
    </Widget>
  )
}
