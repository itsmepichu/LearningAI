/** Greedy context assembly: take candidates in priority order and include each one that still fits. Pure. */
export type ItemKind = 'instructions' | 'live' | 'conversation' | 'retrieved'
export interface ContextItem {
  name: string
  tokens: number
  /** 0 is a must-have; a larger number is dropped sooner. */
  priority: number
  /** Size when summarised, or null if it cannot be compressed. */
  compressed: number | null
  kind: ItemKind
}
export interface AssembledItem extends ContextItem {
  size: number
  isCompressed: boolean
  included: boolean
}
export interface Assembly {
  rows: AssembledItem[]
  used: number
  free: number
  /** Output reserve actually available inside the window. */
  reserved: number
  droppedMust: number
}

export function assemble(items: ContextItem[], budget: number, reserve: number, compress: boolean): Assembly {
  const available = Math.max(0, budget - reserve)
  let left = available
  const rows = [...items]
    .sort((a, b) => a.priority - b.priority)
    .map((item) => {
      const isCompressed = compress && item.compressed !== null
      const size = isCompressed ? item.compressed! : item.tokens
      const included = size <= left
      if (included) left -= size
      return { ...item, size, isCompressed, included }
    })
  return {
    rows,
    used: available - left,
    free: left,
    reserved: Math.min(reserve, budget),
    droppedMust: rows.filter((r) => r.priority === 0 && !r.included).length,
  }
}
