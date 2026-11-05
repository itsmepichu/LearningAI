/** One illustrative month of AI spend, grouped three ways. Each grouping adds up to the same total. Pure. */
import type { ProjectId } from '../../data/projects'

export const GROUPINGS = ['By feature', 'By tenant', 'By token type'] as const
export type Grouping = (typeof GROUPINGS)[number]
export type SpendRow = [label: string, dollars: number]

export const TOTAL = 48200

const FEATURE_DOLLARS = [18700, 14900, 7400, 4100, 3100]
const TOKEN_TYPES: SpendRow[] = [
  ['Output tokens', 21600],
  ['Uncached input', 17400],
  ['Embeddings', 4100],
  ['Cached input', 2900],
  ['Reasoning tokens', 2200],
]

const NAMES: Record<ProjectId, { features: string[]; biggest: string; second: string; third: string; rest: string }> = {
  harbor: {
    features: ['Agent workflows', 'Knowledge-base assistant', 'Batch summaries', 'Embeddings and rerank', 'Ticket triage'],
    biggest: 'Customer Orion',
    second: 'Customer Lyra',
    third: 'Customer Vega',
    rest: 'Other 312 customers',
  },
  store: {
    features: ['Returns and refund agent', 'Shopping assistant', 'Listing summaries', 'Embeddings and rerank', 'Review moderation'],
    biggest: 'Seller Orion',
    second: 'Seller Lyra',
    third: 'Seller Vega',
    rest: 'Other 312 sellers',
  },
  bank: {
    features: ['Dispute investigation agent', 'Customer assistant', 'Case summaries', 'Embeddings and rerank', 'Dispute triage'],
    biggest: 'Business customer Orion',
    second: 'Business customer Lyra',
    third: 'Business customer Vega',
    rest: 'Other 312 business customers',
  },
  travel: {
    features: ['Rebooking agent', 'Trip-planning assistant', 'Itinerary summaries', 'Embeddings and rerank', 'Message triage'],
    biggest: 'Corporate client Orion',
    second: 'Corporate client Lyra',
    third: 'Corporate client Vega',
    rest: 'Other 312 corporate clients',
  },
}

export function spendRows(id: ProjectId, grouping: Grouping): SpendRow[] {
  const n = NAMES[id]
  if (grouping === 'By feature') return n.features.map((f, i) => [f, FEATURE_DOLLARS[i]])
  if (grouping === 'By tenant') {
    return [
      [n.biggest, 14950],
      [n.second, 8200],
      [n.third, 6100],
      [n.rest, 18950],
    ]
  }
  return TOKEN_TYPES
}
