import { useState } from 'react'
import { Slider, Widget, fmt } from '../kit'
import { wilson } from './wilson'

const X = (v: number) => 20 + v * 560

export default function ConfidenceInterval() {
  const [n, setN] = useState(100)
  const [pc, setPc] = useState(86)
  const p = pc / 100
  const ci = wilson(p, n)
  return (
    <Widget name="confidence-interval">
      <div className="row2">
        <Slider label="Test cases" value={n} min={20} max={5000} step={10} onChange={setN} format={(v) => fmt(v)} />
        <Slider label="Observed pass rate" value={pc} min={1} max={99} onChange={setPc} format={(v) => `${v}%`} />
      </div>
      <svg viewBox="0 0 600 90" role="img" aria-label={`Pass rate ${pc}% on ${n} cases: 95% interval ${fmt(ci.low * 100, 1)}% to ${fmt(ci.high * 100, 1)}%.`}>
        <line x1="20" y1="45" x2="580" y2="45" className="grid" />
        {Array.from({ length: 11 }, (_, t) => (
          <g key={t}>
            <line x1={X(t / 10)} y1="40" x2={X(t / 10)} y2="50" className="grid" />
            <text x={X(t / 10)} y="68" textAnchor="middle" className="xs mut">{t * 10}%</text>
          </g>
        ))}
        <rect x={X(ci.low)} y="33" width={X(ci.high) - X(ci.low)} height="24" rx="3" className="fas" style={{ stroke: 'var(--accent)' }} />
        <circle cx={X(p)} cy="45" r="5" className="fs" />
        <text x={X(p)} y="25" textAnchor="middle" className="sm">{fmt(ci.low * 100, 1)}% – {fmt(ci.high * 100, 1)}%</text>
      </svg>
      <div className="out">
        {Math.round(p * n)} / {fmt(n)} passed → 95% CI {fmt(ci.low * 100, 1)}% to {fmt(ci.high * 100, 1)}% (width ±{fmt(ci.half * 100, 1)} points)
      </div>
    </Widget>
  )
}
