/** The events of a saga run, worked out up front so the figure can step through them. Pure. */
import type { StepEvent } from '../kit'

export interface SagaStep {
  action: string
  /** Null when the step cannot be undone. */
  undo: string | null
  /** Why this step fails when the reader makes it fail. */
  failure: string
}
export type SagaEvent = StepEvent

export function sagaEvents(steps: SagaStep[], ref: string, failAt: number, retryFirst: boolean): SagaEvent[] {
  const events: SagaEvent[] = []
  const done: number[] = []
  for (let i = 0; i < steps.length; i++) {
    if (i === failAt) {
      events.push({ tone: 'bad', status: 'Failed', title: `Step ${i + 1}: ${steps[i].action}`, detail: steps[i].failure })
      for (const j of [...done].reverse()) {
        const undo = steps[j].undo
        if (undo) events.push({ tone: 'warn', status: 'Compensated', title: `Step ${j + 1}: ${undo}`, code: `${ref}:comp-${j + 1}` })
      }
      events.push({ tone: 'warn', status: 'Saga ended', title: 'State is consistent: nothing is left half-done' })
      return events
    }
    events.push({ tone: 'ok', status: 'Done', title: `Step ${i + 1}: ${steps[i].action}`, code: `${ref}:${i + 1}` })
    done.push(i)
    if (i === 0 && retryFirst) {
      events.push({
        tone: 'info',
        status: 'Retried',
        title: 'The response to step 1 times out, so the client sends it again with the same key',
        detail: 'The server finds the key and returns the existing result, so no duplicate is created',
        code: `${ref}:1`,
      })
    }
  }
  events.push({ tone: 'ok', status: 'Saga completed', title: 'Every step succeeded' })
  return events
}
