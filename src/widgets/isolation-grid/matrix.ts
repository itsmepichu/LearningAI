/** An example state of the cross-tenant test matrix. Pure. */
export const STORES = ['Retrieval index', 'Agent memory', 'Response cache', 'Semantic cache', 'Prefix/KV cache', 'Logs & traces', 'Agent task state', 'Fine-tuned adapters']
export const SURFACES = ['Chat API', 'Agent tools', 'Admin console', 'Data export']
export type CellState = 'pass' | 'fail' | 'na'

const FAILING = new Set(['Semantic cache|Agent tools'])
const NOT_APPLICABLE = new Set(['Prefix/KV cache|Admin console', 'Prefix/KV cache|Data export', 'Fine-tuned adapters|Data export'])

export function cellState(store: string, surface: string): CellState {
  const key = `${store}|${surface}`
  return FAILING.has(key) ? 'fail' : NOT_APPLICABLE.has(key) ? 'na' : 'pass'
}
