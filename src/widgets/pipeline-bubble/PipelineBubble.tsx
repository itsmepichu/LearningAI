import { useState } from 'react'
import { Slider, Widget, fmt } from '../kit'
import { gpipe } from './schedule'

export default function PipelineBubble() {
  const [stages, setStages] = useState(4)
  const [micro, setMicro] = useState(4)
  const g = gpipe(stages, micro)
  const cw = Math.min(34, 640 / g.slots)
  const rh = Math.min(36, 170 / stages)
  return (
    <Widget name="pipeline-bubble">
      <div className="row2">
        <Slider label="Pipeline stages (GPUs)" value={stages} min={2} max={6} onChange={setStages} />
        <Slider label="Micro-batches" value={micro} min={1} max={12} onChange={setMicro} />
      </div>
      <svg viewBox="0 0 700 200" role="img" aria-label={`GPipe schedule on ${stages} GPUs with ${micro} micro-batches. Idle fraction ${fmt(g.bubble * 100, 1)} percent.`}>
        <text x="44" y="12" className="xs mut">time →</text>
        {Array.from({ length: stages }, (_, st) => (
          <g key={st}>
            <text x="4" y={20 + st * rh + rh / 2 + 4} className="xs mut">GPU{st}</text>
            {Array.from({ length: g.slots }, (_, t) => <rect key={t} x={44 + t * cw} y={20 + st * rh} width={cw - 2} height={rh - 3} rx="2" className="fsunk" />)}
          </g>
        ))}
        {g.blocks.map((b) => (
          <g key={`${b.kind}${b.stage}-${b.micro}`}>
            <rect x={44 + b.slot * cw} y={20 + b.stage * rh} width={cw - 2} height={rh - 3} rx="2" className={b.kind === 'F' ? 'fas' : 'fss'} style={{ stroke: b.kind === 'F' ? 'var(--accent)' : 'var(--signal)' }} />
            <text x={44 + b.slot * cw + cw / 2 - 1} y={20 + b.stage * rh + rh / 2 + 3} textAnchor="middle" className="xs">{b.kind}{b.micro + 1}</text>
          </g>
        ))}
      </svg>
      <div className="out">Total time slots: {g.slots} · busy slots per GPU: {g.busy} · idle (bubble) fraction: {fmt(g.bubble * 100, 1)}%</div>
    </Widget>
  )
}
