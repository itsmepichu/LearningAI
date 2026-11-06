import { useMemo, useState } from 'react'
import { Shuffle } from 'lucide-react'
import { StepPlayer, Widget } from '../kit'
import { Scene3D } from '../scene3d/Scene3D'
import { hnswSteps } from './layers'

/** 9.4: the HNSW search with its layers stacked: the third axis is the layer. */
export default function HnswLayers() {
  const [query, setQuery] = useState(0)
  const [step, setStep] = useState(0)
  const steps = useMemo(() => hnswSteps(query), [query])
  return (
    <Widget name="hnsw-layers">
      <StepPlayer count={steps.length} step={Math.min(step, steps.length - 1)} onStep={setStep} noun="Step" intervalMs={2200} />
      <Scene3D
        steps={steps}
        step={step}
        label="An HNSW index with its two layers stacked, and one search through them"
        legend={
          <>
            <span><i style={{ background: 'var(--accent)' }} />top layer</span>
            <span><i style={{ background: 'var(--muted)' }} />bottom layer</span>
            <span><i style={{ background: 'var(--signal)' }} />search path and visited points</span>
            <span><i style={{ background: 'var(--bad)' }} />query</span>
            <span><i style={{ background: 'var(--ok)' }} />result</span>
          </>
        }
      />
      <div className="ctl">
        <button
          type="button"
          className="btn"
          onClick={() => {
            setQuery((q) => q + 1)
            setStep(0)
          }}
        >
          <Shuffle aria-hidden="true" /> New query
        </button>
      </div>
    </Widget>
  )
}
