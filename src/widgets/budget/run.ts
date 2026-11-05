/** A scripted agent task under a cost budget and an approval limit. Money is in whole cents, so sums stay exact. Pure. */
import type { ProjectId } from '../../data/projects'
import type { StepEvent } from '../kit'

export const APPROVAL_LIMIT = 50

export interface BudgetStep {
  name: string
  cents: number
  /** This step proposes the action that may need approval. */
  proposes?: boolean
}
export interface BudgetScenario {
  /** What the task is doing, followed by the record's reference. */
  task: string
  noun: 'credit' | 'refund'
  approver: string
  steps: BudgetStep[]
}
export type BudgetEvent = StepEvent & { spent: number }

const steps = (lookup: string, detail: string, compute: string, propose: string, draft: string): BudgetStep[] => [
  { name: 'plan', cents: 3 },
  { name: lookup, cents: 4 },
  { name: detail, cents: 5 },
  { name: compute, cents: 0 },
  { name: propose, cents: 5, proposes: true },
  { name: draft, cents: 6 },
]

export const BUDGETS: Record<ProjectId, BudgetScenario> = {
  harbor: { task: 'a service credit on ticket', noun: 'credit', approver: 'support_lead', steps: steps('get_ticket', 'get_account_usage', 'compute credit (code)', 'propose_credit', 'draft reply') },
  store: { task: 'a refund on order', noun: 'refund', approver: 'support_lead', steps: steps('get_order', 'get_shipping_events', 'compute refund (code)', 'propose_refund', 'draft reply') },
  bank: { task: 'a provisional credit on case', noun: 'credit', approver: 'ops_lead', steps: steps('get_case', 'get_transaction', 'compute credit (code)', 'propose_provisional_credit', 'draft letter') },
  travel: { task: 'a goodwill credit on booking', noun: 'credit', approver: 'travel_desk', steps: steps('get_booking', 'get_fare_rules', 'compute credit (code)', 'propose_credit', 'draft reply') },
}

export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`

export function budgetEvents(s: BudgetScenario, budgetCents: number, amount: number): BudgetEvent[] {
  const events: BudgetEvent[] = []
  let spent = 0
  for (const step of s.steps) {
    if (spent + step.cents > budgetCents) {
      events.push({
        tone: 'bad',
        status: 'Budget exhausted',
        title: `Stopped before ${step.name}`,
        detail: `${usd(spent + step.cents)} would pass the ${usd(budgetCents)} budget, so the task stops and escalates with the work so far`,
        spent,
      })
      return events
    }
    spent += step.cents
    const cost = `Cost ${usd(step.cents)}`
    if (step.proposes && amount > APPROVAL_LIMIT) {
      events.push({ tone: 'warn', status: 'Paused', title: `${step.name}: $${amount} is over the $${APPROVAL_LIMIT} limit`, detail: `${cost}. It waits for approval by ${s.approver}, with state checkpointed and the worker released`, spent })
      events.push({ tone: 'info', status: 'Approved', title: 'Approval received (simulated)', detail: 'The task resumes from its checkpoint', spent })
    } else if (step.proposes) {
      events.push({ tone: 'ok', status: 'Done', title: `${step.name}: $${amount} approved automatically`, detail: `${cost}. It is within the $${APPROVAL_LIMIT} limit`, spent })
    } else {
      events.push({ tone: 'ok', status: 'Done', title: step.name, detail: cost, spent })
    }
  }
  events.push({ tone: 'ok', status: 'Task complete', title: `Spent ${usd(spent)} of ${usd(budgetCents)}`, spent })
  return events
}
