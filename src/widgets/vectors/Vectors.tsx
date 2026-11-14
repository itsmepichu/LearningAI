import { useId, useState } from 'react'
import { KpiRow, Slider, Widget, fmt } from '../kit'
import { UNIT, vectors } from './math'

const OX = 180
const OY = 150

export default function Vectors() {
  const id = useId()
  const [angleA, setA] = useState(30)
  const [angleB, setB] = useState(75)
  const [lenA, setLa] = useState(120)
  const [lenB, setLb] = useState(100)
  const v = vectors({ angleA, angleB, lenA, lenB })
  const X = (p: number[]) => OX + p[0]
  const Y = (p: number[]) => OY - p[1]
  const grid = [-160, -120, -80, -40, 0, 40, 80, 120, 160]
  return (
    <Widget name="vectors">
      <div className="row2">
        <Slider label="Angle of a" value={angleA} min={0} max={360} onChange={setA} format={(n) => `${n}°`} />
        <Slider label="Angle of b" value={angleB} min={0} max={360} onChange={setB} format={(n) => `${n}°`} />
        <Slider label="Length of a" value={lenA} min={20} max={140} onChange={setLa} />
        <Slider label="Length of b" value={lenB} min={20} max={140} onChange={setLb} />
      </div>
      <svg viewBox="0 0 360 300" style={{ maxWidth: 360 }} role="img" aria-label={`Two arrows, a and b, ${fmt(v.angle)} degrees apart. Cosine similarity ${fmt(v.cos, 2)}.`}>
        <defs>
          <marker id={`${id}a`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" className="fa" /></marker>
          <marker id={`${id}b`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" className="fv" /></marker>
        </defs>
        {grid.map((g) => (
          <g key={g}>
            <line x1={OX + g} y1="5" x2={OX + g} y2="295" className="grid" />
            <line x1="5" y1={OY + g} x2="355" y2={OY + g} className="grid" />
          </g>
        ))}
        <line x1={OX} y1={OY} x2={X(v.P)} y2={Y(v.P)} className="lns" style={{ strokeWidth: 5, opacity: 0.8 }} />
        <line x1={X(v.A)} y1={Y(v.A)} x2={X(v.P)} y2={Y(v.P)} className="ln dash" />
        <line x1={OX} y1={OY} x2={X(v.A)} y2={Y(v.A)} className="lna" style={{ strokeWidth: 2.5 }} markerEnd={`url(#${id}a)`} />
        <line x1={OX} y1={OY} x2={X(v.B)} y2={Y(v.B)} style={{ stroke: 'var(--sim)', strokeWidth: 2.5, fill: 'none' }} markerEnd={`url(#${id}b)`} />
        <text x={X(v.A) + 6} y={Y(v.A) - 6} className="acc lg">a</text>
        <text x={X(v.B) + 6} y={Y(v.B) - 6} className="simc lg">b</text>
        <circle cx={OX} cy={OY} r="3" className="fm" />
      </svg>
      <KpiRow
        items={[
          { label: 'a · b (units of 100 px)', value: fmt(v.dot / UNIT / UNIT, 2) },
          { label: '‖a‖', value: fmt(lenA / UNIT, 2) },
          { label: '‖b‖', value: fmt(lenB / UNIT, 2) },
          { label: 'cosine similarity', value: fmt(v.cos, 3), tone: v.cos > 0.7 ? 'ok' : v.cos < 0 ? 'bad' : undefined },
          { label: 'angle between', value: `${fmt(v.angle)}°` },
          { label: 'projection length of a on b', value: fmt(v.projection / UNIT, 2) },
        ]}
      />
    </Widget>
  )
}
