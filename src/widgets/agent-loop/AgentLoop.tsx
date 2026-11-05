import { useMemo, useState } from 'react'
import { DataGate, DataSource, EventList, Slider, StepPlayer, Widget, useProjectData } from '../kit'
import { loadAgentScript } from './scenarios'
import { agentEvents, agentSteps, type AgentScript } from './trace'

function Run({ script }: { script: AgentScript }) {
  const [limit, setLimit] = useState(6)
  const [failure, setFailure] = useState(false)
  const events = useMemo(() => agentEvents(agentSteps(script, failure), limit), [script, failure, limit])
  const [picked, setPicked] = useState<number | null>(null)
  // Until the reader steps through a run, the figure shows where the current settings end up.
  const step = picked === null ? events.length - 1 : Math.min(picked, events.length - 1)
  return (
    <>
      <p className="wk-q">
        <b>Task:</b> {script.task}
      </p>
      <div className="row2">
        <Slider
          label="Step limit"
          value={limit}
          min={2}
          max={10}
          onChange={(v) => {
            setLimit(v)
            setPicked(null)
          }}
        />
        <label>
          <input
            type="checkbox"
            checked={failure}
            onChange={(e) => {
              setFailure(e.target.checked)
              setPicked(null)
            }}
          />
          Inject a tool failure
        </label>
      </div>
      <StepPlayer count={events.length} step={step} onStep={setPicked} noun="Event" />
      <EventList events={events.slice(0, step + 1)} />
    </>
  )
}

export default function AgentLoop() {
  const state = useProjectData(loadAgentScript)
  return (
    <Widget name="agent-loop">
      <DataGate state={state}>
        {({ file, script }, project) => (
          <>
            <DataSource project={project} files={[file]}>
              {project.assistant}’s trace is scripted and its costs are illustrative. No model runs here.
            </DataSource>
            <Run key={project.id} script={script} />
          </>
        )}
      </DataGate>
    </Widget>
  )
}
