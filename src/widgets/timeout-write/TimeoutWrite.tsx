import { useMemo, useState } from 'react'
import { DataGate, DataSource, EventList, ScrollRegion, StepPlayer, Widget, useProjectData } from '../kit'
import { loadSagaRef } from '../saga/scenarios'
import { WRITES, writeEvents, type WriteScenario } from './events'

function Run({ scenario, reference }: { scenario: WriteScenario; reference: string }) {
  const [withKey, setWithKey] = useState(true)
  const [step, setStep] = useState(0)
  const events = useMemo(() => writeEvents(scenario, reference, withKey), [scenario, reference, withKey])
  const rows = events[step].rows
  const heading = `${scenario.record[0].toUpperCase()}${scenario.record.slice(1)} store (server)`
  return (
    <>
      <div className="ctl">
        <label>
          <input
            type="checkbox"
            checked={withKey}
            onChange={(e) => {
              setWithKey(e.target.checked)
              setStep(0)
            }}
          />
          Send an idempotency key
        </label>
      </div>
      <StepPlayer count={events.length} step={step} onStep={setStep} noun="Event" />
      <div className="cols2">
        <EventList events={events.slice(0, step + 1)} />
        <div>
          <span className="wk-stream-h">{heading}</span>
          <ScrollRegion label={heading}>
            <table>
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Idempotency key</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.key ? <code>{r.key}</code> : '–'}</td>
                    <td>{r.created}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr className="wk-none">
                    <td colSpan={3}>empty</td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollRegion>
        </div>
      </div>
    </>
  )
}

export default function TimeoutWrite() {
  const state = useProjectData(loadSagaRef)
  return (
    <Widget name="timeout-write">
      <DataGate state={state}>
        {({ file, ref }, project) => (
          <>
            <DataSource project={project} files={[file]}>
              The reference comes from the dataset. The server is an in-page model.
            </DataSource>
            <Run key={project.id} scenario={WRITES[project.id]} reference={ref} />
          </>
        )}
      </DataGate>
    </Widget>
  )
}
