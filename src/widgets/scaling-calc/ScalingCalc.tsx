import { useState } from 'react'
import { KpiRow, Slider, Widget, bytesText, fmt, si, usd } from '../kit'
import { PRICE, run } from './scaling'

export default function ScalingCalc() {
  const [sizeS, setSize] = useState(45)
  const [ratioS, setRatio] = useState(60)
  const [mfu, setMfu] = useState(40)
  const [gpuS, setGpu] = useState(60)
  const r = run(sizeS, ratioS, mfu, gpuS)
  const wall = r.days < 1 ? `${fmt(r.days * 24, 1)} hours` : `${fmt(r.days, r.days < 10 ? 1 : 0)} days`
  return (
    <Widget name="scaling-calc">
      <div className="row2">
        <Slider label="Parameters" value={sizeS} min={0} max={100} onChange={setSize} format={() => `${si(r.N)}`} />
        <Slider label="Tokens per parameter" value={ratioS} min={0} max={100} onChange={setRatio} format={() => fmt(r.R, r.R < 10 ? 1 : 0)} />
        <Slider label="Hardware utilisation (MFU) %" value={mfu} min={20} max={60} onChange={setMfu} format={(v) => `${v}%`} />
        <Slider label="GPUs" value={gpuS} min={0} max={100} onChange={setGpu} format={() => fmt(r.gpus)} />
      </div>
      <KpiRow
        items={[
          { label: 'training tokens D', value: si(r.D) },
          { label: 'compute C = 6ND', value: `${r.C.toExponential(2)} FLOPs` },
          { label: 'GPU-hours', value: si(r.gpuHours) },
          { label: `wall-clock on ${fmt(r.gpus)} GPUs`, value: wall, tone: r.days > 120 ? 'bad' : undefined },
          { label: `cost at $${PRICE.toFixed(2)}/GPU-h`, value: usd(r.cost) },
          { label: 'Chinchilla-optimal D (20N)', value: si(r.chinchilla) },
          { label: 'training state (16 B/param)', value: bytesText(r.state) },
        ]}
      />
    </Widget>
  )
}
