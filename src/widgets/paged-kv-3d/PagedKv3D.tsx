import { useMemo, useState } from 'react'
import { StepPlayer, Widget } from '../kit'
import { Scene3D } from '../scene3d/Scene3D'
import { kvSteps } from './kv'

/** 14.3: the paged KV cache with layers as the third axis: one block table, every layer. */
export default function PagedKv3D() {
  const [share, setShare] = useState(true)
  const [step, setStep] = useState(0)
  const steps = useMemo(() => kvSteps(share), [share])
  return (
    <Widget name="paged-kv-3d">
      <div className="ctl">
        <label>
          <input
            type="checkbox"
            checked={share}
            onChange={(e) => {
              setShare(e.target.checked)
              setStep(0)
            }}
          />{' '}
          Share the system-prompt prefix
        </label>
      </div>
      <StepPlayer count={steps.length} step={step} onStep={setStep} noun="Step" intervalMs={2200} />
      <Scene3D
        steps={steps}
        step={step}
        label="The paged KV cache's block pool, with one copy of the pool per layer stacked front to back"
        legend={
          <>
            <span><i style={{ background: 'var(--sim)' }} />shared prompt</span>
            <span><i style={{ background: 'var(--accent)' }} />sequence A</span>
            <span><i style={{ background: 'var(--signal)' }} />sequence B</span>
            <span><i style={{ background: 'var(--ok)' }} />sequence C</span>
            <span>Faint cubes are free or unfilled slots.</span>
          </>
        }
      />
    </Widget>
  )
}
