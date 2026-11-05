/** A write that succeeds on the server while its response is lost, with and without an idempotency key. Pure. */
import type { ProjectId } from '../../data/projects'
import type { StepEvent } from '../kit'

export interface WriteScenario {
  tool: string
  record: string
  prefix: string
  /** What the duplicate costs in this project. */
  harm: string
}
export interface WriteRow {
  id: string
  key: string | null
  created: string
}
export type WriteEvent = StepEvent & { rows: WriteRow[] }

export const WRITES: Record<ProjectId, WriteScenario> = {
  harbor: { tool: 'create_ticket', record: 'ticket', prefix: 'T-', harm: 'The customer gets two confirmations and two engineers pick up the same issue' },
  store: { tool: 'create_refund', record: 'refund', prefix: 'RF-', harm: 'The shopper is refunded twice and the money has to be recovered' },
  bank: { tool: 'post_credit', record: 'credit', prefix: 'CR-', harm: 'The customer is credited twice and the ledger no longer matches the case' },
  travel: { tool: 'create_rebooking', record: 'rebooking', prefix: 'RB-', harm: 'The traveller holds two seats and pays twice until someone cancels one' },
}

export function writeEvents(s: WriteScenario, ref: string, withKey: boolean): WriteEvent[] {
  const key = withKey ? `task-77:${s.tool}:${ref}` : null
  const first: WriteRow = { id: `${s.prefix}1001`, key, created: 'attempt 1' }
  const second: WriteRow = { id: `${s.prefix}1002`, key: null, created: 'attempt 2 (retry)' }
  const after = withKey ? [first] : [first, second]
  return [
    { tone: 'info', status: 'Client', title: `Sends ${s.tool} for ${ref}`, detail: withKey ? undefined : 'It sends no idempotency key', code: key ?? undefined, rows: [] },
    { tone: 'ok', status: 'Server', title: `Validates and commits ${s.record} ${first.id}`, rows: [first] },
    { tone: 'bad', status: 'Network', title: 'The response is lost', detail: `The client sees a timeout and cannot tell whether the ${s.record} exists`, rows: [first] },
    { tone: 'info', status: 'Client', title: `Retries the same request, with the same arguments${withKey ? ' and the same key' : ''}`, rows: [first] },
    withKey
      ? { tone: 'ok', status: 'Server', title: `Finds the key and returns the stored result, ${first.id}`, detail: `No new ${s.record} is created`, code: key!, rows: after }
      : { tone: 'bad', status: 'Server', title: `Cannot recognise the retry and creates ${second.id}`, detail: 'This is a duplicate', rows: after },
    withKey
      ? { tone: 'ok', status: 'Result', title: `Exactly one ${s.record}`, detail: 'The retry was safe', rows: after }
      : { tone: 'bad', status: 'Result', title: `Two ${s.record}s for one request`, detail: s.harm, rows: after },
  ]
}
