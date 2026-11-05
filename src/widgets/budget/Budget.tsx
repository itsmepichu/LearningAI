import { useMemo, useState } from 'react'
import { BarList, DataGate, DataSource, EventList, SERIES, Slider, StepPlayer, Widget, useProjectData } from '../kit'
import { loadSagaRef } from '../saga/scenarios'
import { BUDGETS, budgetEvents, usd, type BudgetScenario } from './run'

function Run({ scenario, reference }: { scenario: BudgetScenario; reference: string }) {
  const [budget, setBudget] = useState(30)
  const [amount, setAmount] = useState(80)
  const events = useMemo(() => budgetEvents(scenario, budget, amount), [scenario, budget, amount])
  const [picked, setPicked] = useState<number | null>(null)
  // Until the reader steps through a run, the figure shows where the current settings end up.
  const step = picked === null ? events.length - 1 : Math.min(picked, events.length - 1)
  const spent = events[step].spent
  return (
    <>
      <p className="wk-q">
        <b>Task:</b> {scenario.task} <code>{reference}</code>
      </p>
      <div className="row2">
        <Slider
          label="Task budget"
          value={budget / 100}
          min={0.05}
          max={1}
          step={0.05}
          format={(v) => `$${v.toFixed(2)}`}
          onChange={(v) => {
            setBudget(Math.round(v * 100))
            setPicked(null)
          }}
        />
        <Slider
          label={`Proposed ${scenario.noun}`}
          value={amount}
          min={5}
          max={500}
          step={5}
          format={(v) => `$${v}`}
          onChange={(v) => {
            setAmount(v)
            setPicked(null)
          }}
        />
      </div>
      <BarList max={budget} items={[{ label: 'Budget spent', value: spent, text: `${usd(spent)} of ${usd(budget)}`, color: SERIES[0] }]} />
      <StepPlayer count={events.length} step={step} onStep={setPicked} noun="Event" />
      <EventList events={events.slice(0, step + 1)} />
    </>
  )
}

export default function Budget() {
  const state = useProjectData(loadSagaRef)
  return (
    <Widget name="budget">
      <DataGate state={state}>
        {({ file, ref }, project) => (
          <>
            <DataSource project={project} files={[file]}>
              {project.assistant}’s steps and costs are scripted and illustrative. The reference comes from the dataset.
            </DataSource>
            <Run key={project.id} scenario={BUDGETS[project.id]} reference={ref} />
          </>
        )}
      </DataGate>
    </Widget>
  )
}
