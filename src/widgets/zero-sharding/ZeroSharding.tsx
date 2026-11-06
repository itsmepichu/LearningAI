import { useMemo, useState } from 'react'
import { StepPlayer, Widget } from '../kit'
import { Scene3D } from '../scene3d/Scene3D'
import { zeroSteps } from './memory'

const SIZES = [1, 7, 13, 70]
const GPUS = [2, 4, 8, 16]
const CAPACITY = [24, 40, 80]

/** 6.6: memory per GPU across the ZeRO stages: GPUs across, the stage as the third axis, memory as height. */
export default function ZeroSharding() {
  const [size, setSize] = useState(7)
  const [gpus, setGpus] = useState(8)
  const [cap, setCap] = useState(80)
  const [step, setStep] = useState(0)
  const steps = useMemo(() => zeroSteps({ params: size * 1e9, gpus, capacity: cap * 1e9 }), [size, gpus, cap])
  return (
    <Widget name="zero-sharding">
      <div className="ctl">
        <label>
          Model{' '}
          <select value={size} onChange={(e) => setSize(+e.target.value)}>
            {SIZES.map((s) => <option key={s} value={s}>{s}B parameters</option>)}
          </select>
        </label>
        <label>
          GPUs{' '}
          <select value={gpus} onChange={(e) => setGpus(+e.target.value)}>
            {GPUS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label>
          Memory per GPU{' '}
          <select value={cap} onChange={(e) => setCap(+e.target.value)}>
            {CAPACITY.map((c) => <option key={c} value={c}>{c} GB</option>)}
          </select>
        </label>
      </div>
      <StepPlayer count={steps.length} step={step} onStep={setStep} noun="Stage" intervalMs={2600} />
      <Scene3D
        steps={steps}
        step={step}
        label="Memory per GPU under plain data parallelism and the ZeRO stages, with GPUs across and stages front to back"
        legend={
          <>
            <span><i style={{ background: 'var(--accent)' }} />weights</span>
            <span><i style={{ background: 'var(--signal)' }} />gradients</span>
            <span><i style={{ background: 'var(--sim)' }} />optimiser state</span>
            <span><i style={{ background: 'var(--bad)', height: 3 }} />memory per GPU</span>
          </>
        }
      />
    </Widget>
  )
}
