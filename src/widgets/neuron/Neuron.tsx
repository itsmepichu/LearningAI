import { useId, useState } from 'react'
import { Slider, Widget, fmt } from '../kit'
import { ACTIVATIONS, INPUTS, neuron, type ActivationName } from './neuron'

const width = (w: number) => 1 + Math.abs(w) * 2
const colour = (w: number) => (w >= 0 ? 'var(--accent)' : 'var(--bad)')
const clamp = (v: number) => Math.max(5, Math.min(175, v))

export default function Neuron() {
  const id = useId()
  const [w1, setW1] = useState(8)
  const [w2, setW2] = useState(-5)
  const [b, setB] = useState(1)
  const [act, setAct] = useState<ActivationName>('ReLU')
  const [a1, a2, bb] = [w1 / 10, w2 / 10, b / 10]
  const { z, a } = neuron(a1, a2, bb, act)
  const f = ACTIVATIONS[act]
  const X = (v: number) => 20 + ((v + 4) / 8) * 260
  const Y = (v: number) => 90 - v * (act === 'none (linear)' ? 18 : 55)
  let path = ''
  for (let i = 0; i <= 160; i++) {
    const v = -4 + (8 * i) / 160
    path += `${i ? 'L' : 'M'}${X(v)} ${clamp(Y(f(v))).toFixed(1)}`
  }
  return (
    <Widget name="neuron">
      <div className="row2">
        <Slider label="w₁" value={w1} min={-20} max={20} onChange={setW1} format={(v) => fmt(v / 10, 1)} />
        <Slider label="w₂" value={w2} min={-20} max={20} onChange={setW2} format={(v) => fmt(v / 10, 1)} />
        <Slider label="bias b" value={b} min={-20} max={20} onChange={setB} format={(v) => fmt(v / 10, 1)} />
        <label htmlFor={id}>
          activation{' '}
          <select id={id} value={act} onChange={(e) => setAct(e.target.value as ActivationName)}>
            {(Object.keys(ACTIVATIONS) as ActivationName[]).map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="cols2">
        <svg viewBox="0 0 320 180" role="img" aria-label={`One neuron: z = ${fmt(z, 2)}, output a = ${fmt(a, 3)}.`}>
          <circle cx="40" cy="50" r="20" className="nd" />
          <text x="40" y="54" textAnchor="middle" className="sm">x₁={INPUTS[0]}</text>
          <circle cx="40" cy="130" r="20" className="nd" />
          <text x="40" y="134" textAnchor="middle" className="sm">x₂=.5</text>
          <line x1="60" y1="55" x2="140" y2="85" style={{ stroke: colour(a1), strokeWidth: width(a1) }} />
          <line x1="60" y1="125" x2="140" y2="95" style={{ stroke: colour(a2), strokeWidth: width(a2) }} />
          <text x="95" y="58" className="xs">w₁={fmt(a1, 1)}</text>
          <text x="95" y="132" className="xs">w₂={fmt(a2, 1)}</text>
          <circle cx="165" cy="90" r="26" className="nda" />
          <text x="165" y="86" textAnchor="middle" className="sm">Σ + b</text>
          <text x="165" y="102" textAnchor="middle" className="xs">z={fmt(z, 2)}</text>
          <text x="165" y="138" textAnchor="middle" className="xs mut">b={fmt(bb, 1)}</text>
          <line x1="191" y1="90" x2="225" y2="90" className="ln" />
          <rect x="225" y="72" width="40" height="36" rx="4" className="nds" />
          <text x="245" y="94" textAnchor="middle" className="xs">f(z)</text>
          <line x1="265" y1="90" x2="285" y2="90" className="ln" />
          <text x="300" y="86" textAnchor="middle" className="sm">a =</text>
          <text x="300" y="104" textAnchor="middle" className="sm acc">{fmt(a, 3)}</text>
        </svg>
        <svg viewBox="0 0 300 180" role="img" aria-label={`The ${act} activation curve with the current z marked.`}>
          <line x1="20" y1="90" x2="280" y2="90" className="grid" />
          <line x1="150" y1="10" x2="150" y2="170" className="grid" />
          <path d={path} className="lna" />
          <circle cx={X(Math.max(-4, Math.min(4, z)))} cy={clamp(Y(a))} r="6" className="fs" />
          <text x="24" y="20" className="xs mut">{act}</text>
          <text x="276" y="104" textAnchor="end" className="xs mut">z</text>
        </svg>
      </div>
    </Widget>
  )
}
