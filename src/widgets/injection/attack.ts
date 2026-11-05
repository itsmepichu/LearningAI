/** Which defence stops an indirect prompt injection, in the order the layers meet the attack. Scripted and pure. */
import type { StepEvent } from '../kit'

export type DefenceId = 'untrusted' | 'classifier' | 'readonly' | 'confirm' | 'egress'
export const DEFENCES: DefenceId[] = ['untrusted', 'classifier', 'readonly', 'confirm', 'egress']

export interface AttackScenario {
  /** The untrusted content, such as "email" or "review". */
  source: string
  /** What the user asked for, without the capital or the quotes. */
  request: string
  /** A read tool call the hidden text asks for. */
  readCall: string
  /** The private data it then tries to send. */
  stolen: string
  recipient: string
}

export function defenceLabel(id: DefenceId, s: AttackScenario): string {
  return {
    untrusted: `Mark ${s.source} content as untrusted data (delimiters + instruction)`,
    classifier: `Injection classifier on ${s.source} content`,
    readonly: 'Read-only tools while untrusted content is in context',
    confirm: 'send_email needs the user to confirm recipient + body',
    egress: 'Egress allowlist: external recipients blocked',
  }[id]
}

export function attackEvents(s: AttackScenario, on: ReadonlySet<DefenceId>): StepEvent[] {
  const events: StepEvent[] = [{ tone: 'info', status: 'Read', title: `The assistant reads the ${s.source} to answer “${s.request}”` }]
  if (on.has('classifier')) {
    events.push({ tone: 'ok', status: 'Blocked', title: 'The classifier flags the hidden instruction and strips it', detail: `The ${s.source} is marked low-trust. Classifiers catch known patterns, and novel phrasings can slip through` })
    events.push({ tone: 'ok', status: 'Result', title: 'Answer only. No data left the system' })
    return events
  }
  events.push(
    on.has('untrusted')
      ? { tone: 'warn', status: 'Not enough', title: `The model has been told ${s.source} text is data, not instructions`, detail: 'In this run it still follows the hidden instruction. This lowers the success rate but is not reliable on its own' }
      : { tone: 'bad', status: 'Followed', title: 'The model treats the hidden text as an instruction' },
  )
  events.push({ tone: 'warn', status: 'Allowed', title: `It calls ${s.readCall}`, detail: 'This is a read action this user is allowed to make' })
  const send = `send_email(to="${s.recipient}", attachments=${s.stolen})`
  if (on.has('readonly')) {
    events.push({ tone: 'ok', status: 'Blocked', title: 'It attempts send_email', detail: 'Write and send tools are disabled while untrusted content is in context' })
    events.push({ tone: 'ok', status: 'Result', title: 'Exfiltration is prevented by the architecture', detail: 'The event is logged for security review' })
    return events
  }
  if (on.has('egress')) {
    events.push({ tone: 'ok', status: 'Blocked', title: `It attempts ${send}`, detail: 'Egress policy: the external domain is not on the allowlist' })
    events.push({ tone: 'ok', status: 'Result', title: 'Blocked at the tool layer', detail: 'An alert is raised' })
    return events
  }
  if (on.has('confirm')) {
    events.push({ tone: 'ok', status: 'Stopped', title: 'It proposes send_email', detail: `The user sees “Send ${s.stolen} to ${s.recipient}?” and rejects it` })
    events.push({ tone: 'warn', status: 'Result', title: 'Stopped, but only because the user noticed', detail: 'Combine this with an egress allowlist' })
    return events
  }
  events.push({ tone: 'bad', status: 'Sent', title: `It calls ${send}` })
  events.push({ tone: 'bad', status: 'Result', title: 'Private data is exfiltrated, and the answer does not mention it' })
  return events
}
