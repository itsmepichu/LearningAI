/** Reciprocal rank fusion: score = Σ 1 / (k + rank), over every ranked list that holds the document. Pure. */
export interface Fused {
  id: string
  score: number
  /** How many of the lists found it. */
  lists: number
}

export function fuse(lists: string[][], k: number): Fused[] {
  const scores = new Map<string, Fused>()
  for (const list of lists) {
    list.forEach((id, i) => {
      const hit = scores.get(id) ?? { id, score: 0, lists: 0 }
      hit.score += 1 / (k + i + 1)
      hit.lists += 1
      scores.set(id, hit)
    })
  }
  return [...scores.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}
