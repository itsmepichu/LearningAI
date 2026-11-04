import { useId, useMemo, useState } from 'react'
import { DataGate, DataSource, StepPlayer, Widget, useProjectData } from '../kit'
import { sagaEvents } from './events'
import { SAGAS, loadSagaRef, type SagaScenario } from './scenarios'

const NO_FAILURE = -1
const DEFAULT_FAILURE = 2

function Run({ scenario, reference }: { scenario: SagaScenario; reference: string }) {
  const failId = useId()
  const [failAt, setFailAt] = useState(DEFAULT_FAILURE)
  const [retry, setRetry] = useState(true)
  const [step, setStep] = useState(0)
  const events = useMemo(() => sagaEvents(scenario.steps, reference, failAt, retry), [scenario, reference, failAt, retry])
  const change = (apply: () => void) => {
    apply()
    setStep(0)
  }
  return (
    <>
      <p className="wk-q">
        <b>Task:</b> {scenario.task} <code>{reference}</code>
      </p>
      <div className="ctl">
        <label htmlFor={failId}>
          Fail at step
          <select id={failId} value={failAt} onChange={(e) => change(() => setFailAt(+e.target.value))}>
            <option value={NO_FAILURE}>none</option>
            {scenario.steps.slice(1).map((s, i) => (
              <option key={s.action} value={i + 1}>
                {i + 2} · {s.action}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={retry} onChange={(e) => change(() => setRetry(e.target.checked))} />
          Retry step 1 once (duplicate)
        </label>
      </div>
      <StepPlayer count={events.length} step={step} onStep={setStep} noun="Event" />
      <div className="wk-events">
        {events.slice(0, step + 1).map((e, i) => (
          <div key={i} className={'wk-ev ' + e.tone}>
            <span className="wk-ev-s">{e.status}.</span> <b>{e.title}.</b>
            {e.detail && <> {e.detail}.</>}
            {e.code && (
              <>
                {' '}
                Key <code>{e.code}</code>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

export default function Saga() {
  const state = useProjectData(loadSagaRef)
  return (
    <Widget name="saga">
      <DataGate state={state}>
        {({ file, ref }, project) => (
          <>
            <DataSource project={project} files={[file]}>
              {project.assistant}’s steps are scripted. The reference comes from the dataset.
            </DataSource>
            <Run key={project.id} scenario={SAGAS[project.id]} reference={ref} />
          </>
        )}
      </DataGate>
    </Widget>
  )
}
