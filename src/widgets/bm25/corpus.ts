import type { Project, ProjectId } from '../../data/projects'
import type { DataReader } from '../kit'
import type { Bm25Doc } from './engine'

export interface CorpusDoc extends Bm25Doc {
  title: string
  /** What the results table shows. */
  body: string
}
export interface Corpus {
  file: string
  noun: string
  docs: CorpusDoc[]
}
export interface Suggestion {
  q: string
  shows: string
}

interface Policy {
  id: string
  title: string
  text: string
  current?: boolean
}

const fromPolicies = (rows: Policy[]): CorpusDoc[] =>
  rows.filter((d) => d.current !== false).map((d) => ({ id: d.id, title: d.title, body: d.text, text: `${d.title} ${d.text}` }))

/** Each project's searchable documents, from its dataset. Harbor's older revisions are left out on purpose. */
export async function loadCorpus(p: Project, read: DataReader): Promise<Corpus> {
  if (p.id === 'store') {
    const rows = await read.csv('products.csv')
    return {
      file: 'products.csv',
      noun: 'product listings',
      docs: rows.map((r) => ({ id: r.sku, title: r.title, body: `${r.category} · ${r.brand}`, text: `${r.sku} ${r.title} ${r.category} ${r.brand}` })),
    }
  }
  if (p.id === 'travel') return { file: 'fare_rules.json', noun: 'fare rules', docs: fromPolicies(await read.json<Policy[]>('fare_rules.json')) }
  return { file: 'policies.json', noun: p.id === 'bank' ? 'policies' : 'current policies', docs: fromPolicies(await read.json<Policy[]>('policies.json')) }
}

/** Queries chosen by running them over the dataset: each one shows something specific about keyword search. */
export const SUGGESTIONS: Record<ProjectId, Suggestion[]> = {
  harbor: [
    { q: 'annual leave carry over', shows: 'The query uses the policy’s own words, so the right document wins by a wide margin.' },
    { q: 'HTTP 429', shows: 'An exact code: one document contains it, and every other document scores zero.' },
    { q: 'cannot log in', shows: 'Vocabulary mismatch: “log” only matches the audit log. The relevant policy says “password login” and “sign-on”.' },
  ],
  store: [
    { q: 'BZ-FOO-1130', shows: 'An exact SKU: one listing contains it, and an embedding has little to hold on to.' },
    { q: 'UK 8 sneakers', shows: 'Sizes and product words match titles directly, which is where keyword search does well.' },
    { q: 'comfortable shoes for walking UK 8', shows: '“Comfortable” and “walking” appear nowhere, so only “shoe”, “UK” and “8” count. Keyword search cannot judge comfort.' },
  ],
  bank: [
    { q: '3.5% markup', shows: 'Exact terms: the foreign transaction policy wins clearly.' },
    { q: 'UPI debit reversal', shows: 'The right policy says “debited” and “reversed”, which do not match, so a limits policy ranks first on “UPI” alone.' },
    { q: 'பணம் கழிக்கப்பட்டது payment fail', shows: 'The query means “money was deducted, payment failed”. The Tamil words match nothing; only the English “payment” and “fail” score.' },
  ],
  travel: [
    { q: 'saver change fee', shows: 'The query uses the rule’s own words, and the saver-fare change rule ranks first.' },
    { q: '48 hours', shows: 'An exact phrase is split into two terms: “48” is rare and picks the hotel rule; “hour” alone also matches two fare rules.' },
    { q: 'flight cancelled because of heavy rain', shows: 'The weather rule ranks first on “flight” and “because”, not “rain”, which it never mentions. That win is partly luck.' },
  ],
}
