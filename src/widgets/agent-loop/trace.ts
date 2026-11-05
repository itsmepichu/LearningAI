/** A scripted agent run with a step limit and loop detection. Costs are in tenths of a cent, so sums stay exact. Pure. */
import type { StepEvent } from '../kit'

export interface AgentScript {
  task: string
  plan: string
  lookup: { call: string; result: string }
  inspect: { call: string; result: string }
  policy: { call: string; result: string }
  act: { call: string; result: string }
  final: string
  /** What the escalation says it has established when the tool keeps failing. */
  escalation: string
}
export interface AgentStep {
  kind: 'plan' | 'action' | 'final' | 'stop'
  text: string
  observation?: string
  failed?: boolean
  mills: number
}

export function agentSteps(s: AgentScript, injectFailure: boolean): AgentStep[] {
  const start: AgentStep[] = [
    { kind: 'plan', text: s.plan, mills: 4 },
    { kind: 'action', text: s.lookup.call, observation: s.lookup.result, mills: 4 },
  ]
  if (injectFailure) {
    const timeout = 'ERROR: timeout after 10 s'
    return [
      ...start,
      { kind: 'action', text: s.inspect.call, observation: timeout, failed: true, mills: 6 },
      { kind: 'action', text: `${s.inspect.call} (retry)`, observation: timeout, failed: true, mills: 6 },
      { kind: 'stop', text: `The identical call failed twice, so the loop detector escalates to a person: ${s.escalation}`, mills: 0 },
    ]
  }
  return [
    ...start,
    { kind: 'action', text: s.inspect.call, observation: s.inspect.result, mills: 6 },
    { kind: 'action', text: s.policy.call, observation: s.policy.result, mills: 5 },
    { kind: 'action', text: s.act.call, observation: s.act.result, mills: 5 },
    { kind: 'final', text: s.final, mills: 6 },
  ]
}

export const dollars = (mills: number) => `$${(mills / 1000).toFixed(3)}`

const LABEL = { plan: 'Plan', action: 'Action', final: 'Final answer', stop: 'Stopped' }

/** The run as events. A step limit below the script's length cuts it short and escalates. */
export function agentEvents(steps: AgentStep[], limit: number): StepEvent[] {
  const events: StepEvent[] = []
  let cost = 0
  for (let i = 0; i < steps.length; i++) {
    if (i >= limit) {
      events.push({ tone: 'bad', status: 'Step limit', title: `The limit of ${limit} steps is reached`, detail: 'The run stops and escalates with the work so far' })
      break
    }
    const s = steps[i]
    cost += s.mills
    const running = `Running cost ${dollars(cost)}`
    events.push({
      tone: s.kind === 'final' ? 'ok' : s.kind === 'stop' || s.failed ? 'bad' : 'info',
      status: `Step ${i + 1}, ${LABEL[s.kind]}`,
      title: s.text,
      detail: s.observation ? `Observation: ${s.observation}. ${running}` : running,
    })
  }
  return events
}
