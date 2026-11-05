/** What an answer-cache key must contain, and what it costs in hit rate. Pure. */
export type FieldId = 'tenant' | 'scope' | 'locale' | 'model' | 'prompt' | 'index'
export const FIELD_IDS: FieldId[] = ['tenant', 'scope', 'locale', 'model', 'prompt', 'index']
/** Security fields: leaving one out leaks data rather than serving a stale or wrong answer. */
export const SECURITY: FieldId[] = ['tenant', 'scope']

/** Illustrative: how much each field splits the cache. */
const SPLIT: Record<FieldId, number> = { tenant: 0.6, scope: 0.7, locale: 0.9, model: 0.98, prompt: 0.97, index: 0.85 }
const BASE_HIT_RATE = 30

export interface CacheCase {
  text: string
  needs: FieldId
  harm: string
}

export function hitRate(on: ReadonlySet<FieldId>): number {
  return FIELD_IDS.reduce((rate, f) => (on.has(f) ? rate * SPLIT[f] : rate), BASE_HIT_RATE)
}

export const keyPreview = (on: ReadonlySet<FieldId>) => `hash(${['normalised_question', ...FIELD_IDS.filter((f) => on.has(f))].join(' + ')})`

export function evaluate(on: ReadonlySet<FieldId>, cases: CacheCase[]) {
  const results = cases.map((c) => ({ ...c, safe: on.has(c.needs), severe: SECURITY.includes(c.needs) }))
  return { results, unsafe: results.filter((r) => !r.safe).length, securityPresent: SECURITY.every((f) => on.has(f)) }
}
