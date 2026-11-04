import type { Project } from '../../data/projects'
import { loadJson } from '../kit'

export interface StreamScenario {
  question: string
  answer: string
  file: string
  /** True when the answer text is written for this figure, not quoted from the dataset. */
  illustrativeAnswer: boolean
}

interface Doc {
  id: string
  text: string
}

const textOf = (rows: Doc[], id: string) => rows.find((r) => r.id === id)!.text

/** A question and answer for each project, using the dataset's own wording wherever it has it. */
export async function loadStreamScenario(p: Project): Promise<StreamScenario> {
  if (p.id === 'store') {
    const chats = await loadJson<Doc[]>(p, 'chats.json')
    return {
      question: textOf(chats, 'CH-001'),
      answer: 'Order OD-2503112 left the courier hub yesterday and should now arrive by Friday. You can track it from the Orders page.',
      file: 'chats.json',
      illustrativeAnswer: true,
    }
  }
  if (p.id === 'travel') {
    const [messages, rules] = await Promise.all([loadJson<Doc[]>(p, 'messages.json'), loadJson<Doc[]>(p, 'fare_rules.json')])
    return { question: textOf(messages, 'MS-001'), answer: textOf(rules, 'SR-002'), file: 'fare_rules.json', illustrativeAnswer: false }
  }
  const rows = await loadJson<Doc[]>(p, 'policies.json')
  return p.id === 'bank'
    ? { question: 'Money was debited but my UPI payment failed. What happens now?', answer: textOf(rows, 'NB-002'), file: 'policies.json', illustrativeAnswer: false }
    : { question: 'How long are audit log entries kept?', answer: textOf(rows, 'HP-014'), file: 'policies.json', illustrativeAnswer: false }
}

/** How many word pieces are on screen at time `t`: nothing before the first token, then a steady rate. */
export function piecesAt(t: number, ttft: number, generation: number, pieces: number): number {
  if (t < ttft) return 0
  return Math.min(pieces, Math.floor(((t - ttft) / generation) * pieces) + 1)
}
