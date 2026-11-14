import { useState } from 'react'
import { KpiRow, Slider, Widget, bytesText, fmt, si } from '../kit'
import { costs, relative } from './costs'

const X = (e: number) => 50 + ((e - 10) / 7) * 540
const Y = (v: number) => 140 - v * 120

export default function ContextCost() {
  const [exp, setExp] = useState(13)
  const c = costs(exp)
  let a = ''
  let b = ''
  for (let e = 10; e <= 17.001; e += 0.05) {
    const r = relative(e)
    a += `${a ? 'L' : 'M'}${X(e).toFixed(1)} ${Y(r.linear).toFixed(1)}`
    b += `${b ? 'L' : 'M'}${X(e).toFixed(1)} ${Y(r.quadratic).toFixed(1)}`
  }
  return (
    <Widget name="context-cost">
      <Slider label="Context length" value={exp} min={10} max={17} onChange={setExp} format={(v) => `${si(2 ** v, 0)} tokens`} />
      <svg viewBox="0 0 620 170" role="img" aria-label={`KV cache grows in a straight line with context length and attention compute grows with its square. At ${fmt(c.n)} tokens: ${bytesText(c.kv)} of KV cache.`}>
        <line x1="50" y1="15" x2="50" y2="140" className="grid" />
        <line x1="50" y1="140" x2="590" y2="140" className="grid" />
        <path d={a} className="lns" />
        <path d={b} className="lnb" />
        <line x1={X(exp)} y1="15" x2={X(exp)} y2="140" className="ln dash" />
        {[10, 11, 12, 13, 14, 15, 16, 17].map((e) => <text key={e} x={X(e)} y="158" textAnchor="middle" className="xs mut">{si(2 ** e, 0)}</text>)}
        <text x="400" y="40" className="xs sig">KV cache (linear)</text>
        <text x="400" y="56" className="xs bad">attention compute (quadratic)</text>
        <text x="54" y="26" className="xs mut">relative to 128k value</text>
      </svg>
      <KpiRow
        items={[
          { label: 'attention FLOPs (32 layers)', value: si(c.flops) },
          { label: 'KV cache per sequence', value: bytesText(c.kv) },
          { label: 'vs 8k context: attention', value: `${fmt(c.attnRatio, 2)}×` },
          { label: 'vs 8k context: KV', value: `${fmt(c.kvRatio, 2)}×` },
        ]}
      />
    </Widget>
  )
}
