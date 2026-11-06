import { useMemo, useState } from 'react'
import { StepPlayer, Widget, useProject } from '../kit'
import { Scene3D } from '../scene3d/Scene3D'
import { globeSteps } from './regions'

/** 15.7: a regional failover on a globe, for the selected project: latency, capacity and residency. */
export default function FailoverGlobe() {
  const project = useProject().id
  const [step, setStep] = useState(0)
  const steps = useMemo(() => globeSteps(project), [project])
  return (
    <Widget name="failover-globe">
      <StepPlayer count={steps.length} step={step} onStep={setStep} noun="Step" intervalMs={3200} />
      <Scene3D
        steps={steps}
        step={step}
        label="A globe with the serving regions and user cities, and the routes between them"
        start={{ az: 0, el: 0.3, zoom: 1 }}
        legend={
          <>
            <span><i style={{ background: 'var(--accent)' }} />region, and normal routes</span>
            <span><i style={{ background: 'var(--bad)' }} />failed region</span>
            <span><i style={{ background: 'var(--signal)' }} />rerouted traffic</span>
            <span><i style={{ background: 'var(--sim)' }} />replication</span>
            <span><i style={{ background: 'var(--ink)' }} />users, sized by share</span>
          </>
        }
      />
    </Widget>
  )
}
