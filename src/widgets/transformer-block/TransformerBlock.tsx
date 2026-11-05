import { useMemo, useState } from 'react'
import { Shuffle } from 'lucide-react'
import { StepPlayer, Widget } from '../kit'
import { Scene3D } from '../scene3d/Scene3D'
import { Legend3D } from '../scene3d/Legend3D'
import { blockSteps } from './steps'

/** 5.3: one pre-norm block exploded into floors, one per stage. A real forward pass with random weights. */
export default function TransformerBlock() {
  const [seed, setSeed] = useState(3)
  const [step, setStep] = useState(0)
  const steps = useMemo(() => blockSteps(seed), [seed])
  return (
    <Widget name="transformer-block">
      <StepPlayer count={steps.length} step={step} onStep={setStep} noun="Stage" intervalMs={2600} />
      <Scene3D steps={steps} step={step} label="One transformer block exploded into floors, one per stage" legend={<Legend3D />} />
      <div className="ctl">
        <button type="button" className="btn" onClick={() => setSeed((s) => s + 1)}>
          <Shuffle aria-hidden="true" /> New random input and weights
        </button>
      </div>
    </Widget>
  )
}
