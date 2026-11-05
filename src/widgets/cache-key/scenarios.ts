import type { Project, ProjectId } from '../../data/projects'
import type { DataReader } from '../kit'
import type { CacheCase, FieldId } from './key'

interface Tenancy {
  /** Who one tenant is here, as in "one business customer". */
  tenant: string
  low: string
  high: string
  edited: string
  speaker: string
  /** Cached answer about this tenant's data, for the cross-tenant case. */
  asked: string
}
export const TENANCY: Record<ProjectId, Tenancy> = {
  harbor: { tenant: 'customer workspace', low: 'An intern', high: 'an HR admin', edited: 'The refund policy was edited', speaker: 'A German user', asked: 'the exact question workspace A asked' },
  store: { tenant: 'seller', low: 'A shopper', high: 'a seller’s account manager', edited: 'The returns policy was edited', speaker: 'A Hindi speaker', asked: 'the question seller A asked about its sales' },
  bank: { tenant: 'business customer', low: 'A branch teller', high: 'a fraud analyst', edited: 'The dispute policy was edited', speaker: 'A Tamil speaker', asked: 'the question business customer A asked about its accounts' },
  travel: { tenant: 'corporate client', low: 'A traveller', high: 'a travel desk agent', edited: 'The fare rules were edited', speaker: 'A Hindi speaker', asked: 'the question corporate client A asked about its travel policy' },
}

export function fieldLabel(id: FieldId, projectId: ProjectId): string {
  return {
    tenant: `Tenant ID (${TENANCY[projectId].tenant})`,
    scope: 'User access scope (groups or role)',
    locale: 'Locale or language',
    model: 'Model version',
    prompt: 'Prompt version',
    index: 'Index and source versions',
  }[id]
}

export function casesFor(id: ProjectId): CacheCase[] {
  const t = TENANCY[id]
  const b = `${t.tenant[0].toUpperCase()}${t.tenant.slice(1)} B`
  return [
    { text: `${b} asks ${t.asked}`, needs: 'tenant', harm: 'Serves tenant A’s answer to tenant B: a cross-tenant leak.' },
    { text: `${t.low} asks a question first asked by ${t.high}`, needs: 'scope', harm: `Serves content ${t.low.toLowerCase()} may not read.` },
    { text: `${t.edited} an hour ago`, needs: 'index', harm: 'Serves an answer based on the old version.' },
    { text: `${t.speaker} asks a question cached in English`, needs: 'locale', harm: 'Serves an answer in the wrong language.' },
    { text: 'Prompt v13 fixed a citation bug', needs: 'prompt', harm: 'Keeps serving answers from the buggy prompt.' },
    { text: 'The model was upgraded', needs: 'model', harm: 'Serves old-model answers. Usually minor, but it breaks A/B attribution.' },
  ]
}

/** One real question from each dataset, so the key is built for something a user asked. */
export async function loadCachedQuestion(p: Project, read: DataReader): Promise<{ file: string; question: string }> {
  if (p.id === 'harbor') {
    const [row] = await read.csv('tickets.csv', 1)
    return { file: 'tickets.csv', question: row.text }
  }
  if (p.id === 'store') {
    const rows = await read.json<{ id: string; text: string }[]>('chats.json')
    return { file: 'chats.json', question: rows.find((r) => r.id === 'CH-003')!.text }
  }
  if (p.id === 'travel') {
    const rows = await read.json<{ id: string; text: string }[]>('messages.json')
    return { file: 'messages.json', question: rows.find((r) => r.id === 'MS-001')!.text }
  }
  const rows = await read.json<{ id: string; title: string }[]>('policies.json')
  return { file: 'policies.json', question: `What are the ${rows.find((r) => r.id === 'NB-005')!.title.toLowerCase()}?` }
}
