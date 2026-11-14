import { useId, useState } from 'react'
import { Slider, Widget, fmt } from '../kit'
import { DECAYS, STEPS, learningRate, type Decay } from './schedule'

const X = (t: number) => 50 + t * 550
const Y = (v: number) => 170 - (v / 3e-3) * 150

export default function LrSchedule() {
  const id = useId()
  const [peak, setPeak] = useState(6)
  const [warm, setWarm] = useState(5)
  const [kind, setKind] = useState<Decay>('cosine')
  const wu = warm / 100
  let d = ''
  for (let i = 0; i <= 300; i++) {
    const t = i / 300
    d += `${i ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(learningRate(t, peak * 1e-4, wu, kind)).toFixed(1)}`
  }
  return (
    <Widget name="lr-schedule">
      <div className="row2">
        <Slider label="Peak LR (×10⁻⁴)" value={peak} min={1} max={30} onChange={setPeak} format={(v) => `${v}×10⁻⁴`} />
        <Slider label="Warm-up %" value={warm} min={0} max={30} onChange={setWarm} format={(v) => `${v}%`} />
        <label htmlFor={id}>
          Decay{' '}
          <select id={id} value={kind} onChange={(e) => setKind(e.target.value as Decay)}>
            {DECAYS.map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
      </div>
      <svg viewBox="0 0 620 200" role="img" aria-label={`Learning rate over ${fmt(STEPS)} steps: peak ${peak} times 10 to the minus 4, ${warm} percent warm-up, ${kind} decay.`}>
        <line x1="50" y1="15" x2="50" y2="170" className="grid" />
        <line x1="50" y1="170" x2="600" y2="170" className="grid" />
        {wu > 0 && <rect x="50" y="15" width={wu * 550} height="155" className="fss" style={{ opacity: 0.45 }} />}
        <path d={d} className="lna" style={{ strokeWidth: 2.5 }} />
        {[0, 1e-3, 2e-3, 3e-3].map((v) => <text key={v} x="44" y={Y(v) + 4} textAnchor="end" className="xs mut">{v ? `${fmt(v * 1e3)}e-3` : '0'}</text>)}
        {[0, 2500, 5000, 7500, 10000].map((v) => <text key={v} x={X(v / STEPS)} y="188" textAnchor="middle" className="xs mut">{fmt(v)}</text>)}
        {wu > 0 && <text x={50 + wu * 275} y="30" textAnchor="middle" className="xs sig">warm-up</text>}
      </svg>
    </Widget>
  )
}
