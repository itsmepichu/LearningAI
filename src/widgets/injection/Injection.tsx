import { useMemo, useState } from 'react'
import { DataGate, DataSource, EventList, StepPlayer, Widget, useProjectData } from '../kit'
import { DEFENCES, attackEvents, defenceLabel, type DefenceId } from './attack'
import { loadInjection, type InjectionScenario } from './scenarios'

function Run({ scenario }: { scenario: InjectionScenario }) {
  const [on, setOn] = useState<ReadonlySet<DefenceId>>(new Set())
  const events = useMemo(() => attackEvents(scenario, on), [scenario, on])
  const [picked, setPicked] = useState<number | null>(null)
  // Until the reader steps through a run, the figure shows where the chosen defences end up.
  const step = picked === null ? events.length - 1 : Math.min(picked, events.length - 1)
  const toggle = (id: DefenceId, checked: boolean) => {
    const next = new Set(on)
    if (checked) next.add(id)
    else next.delete(id)
    setOn(next)
    setPicked(null)
  }
  return (
    <>
      <div className="out">
        {scenario.doc.map((part, i) =>
          part.hidden ? (
            <span key={i} className="wk-hidden">
              {part.text}
            </span>
          ) : (
            part.text
          ),
        )}
      </div>
      <p className="wk-hint">The marked text is the attacker’s instruction, written for the assistant rather than for the person reading.</p>
      <div className="row2">
        {DEFENCES.map((id) => (
          <label key={id}>
            <input type="checkbox" checked={on.has(id)} onChange={(e) => toggle(id, e.target.checked)} />
            {defenceLabel(id, scenario)}
          </label>
        ))}
      </div>
      <p className="wk-q">
        <b>User asks:</b> “{scenario.request}”
      </p>
      <StepPlayer count={events.length} step={step} onStep={setPicked} noun="Event" />
      <EventList events={events.slice(0, step + 1)} />
    </>
  )
}

export default function Injection() {
  const state = useProjectData(loadInjection)
  return (
    <Widget name="injection">
      <DataGate state={state}>
        {(scenario, project) => (
          <>
            <DataSource project={project} files={[scenario.file]}>
              {scenario.note} No model runs here.
            </DataSource>
            <Run key={project.id} scenario={scenario} />
          </>
        )}
      </DataGate>
    </Widget>
  )
}
