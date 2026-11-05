import { useMemo, useState } from 'react'
import { Shuffle } from 'lucide-react'
import { StepPlayer, Widget } from '../kit'
import { Scene3D } from '../scene3d/Scene3D'
import { Legend3D } from '../scene3d/Legend3D'
import { multiheadSteps } from './steps'

/** 5.2: multi-head attention as tensors in 3D, where the third axis is the head. Real arithmetic on random weights. */
export default function Multihead() {
  const [seed, setSeed] = useState(7)
  const [step, setStep] = useState(0)
  const steps = useMemo(() => multiheadSteps(seed), [seed])
  return (
    <Widget name="multihead">
      <StepPlayer count={steps.length} step={step} onStep={setStep} noun="Step" intervalMs={2600} />
      <Scene3D steps={steps} step={step} label="Multi-head attention as tensors, with heads along the third axis" legend={<Legend3D weights />} />
      <div className="ctl">
        <button type="button" className="btn" onClick={() => setSeed((s) => s + 1)}>
          <Shuffle aria-hidden="true" /> New random weights
        </button>
      </div>
    </Widget>
  )
}
