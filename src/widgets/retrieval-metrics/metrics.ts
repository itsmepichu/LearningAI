/** Rank-based retrieval metrics at a cutoff k. Pure, so the arithmetic can be tested without a browser. */
export type Gain = 'linear' | 'exponential'
export interface RankMetrics {
  recall: number
  precision: number
  /** Reciprocal rank of the first relevant result within the cutoff, else 0. */
  rr: number
  ndcg: number
}

const gainOf = (g: number, gain: Gain) => (gain === 'exponential' ? 2 ** g - 1 : g)
const dcg = (grades: number[], gain: Gain) => grades.reduce((s, g, i) => s + gainOf(g, gain) / Math.log2(i + 2), 0)

/**
 * @param ranked relevance grade of each result, in rank order (0 = not relevant)
 * @param k cutoff
 * @param allRelevant grades of every relevant item in the corpus, including any the retriever did not return
 */
export function rankMetrics(ranked: number[], k: number, allRelevant: number[], gain: Gain = 'linear'): RankMetrics {
  const top = ranked.slice(0, k)
  const hits = top.filter((g) => g > 0).length
  const first = top.findIndex((g) => g > 0)
  const ideal = [...allRelevant].sort((a, b) => b - a).slice(0, k)
  const idcg = dcg(ideal, gain)
  return {
    recall: allRelevant.length ? hits / allRelevant.length : 0,
    precision: k ? hits / k : 0,
    rr: first < 0 ? 0 : 1 / (first + 1),
    ndcg: idcg ? dcg(top, gain) / idcg : 0,
  }
}

/**
 * Grades of every relevant item, once the reader may have re-graded results in a list.
 * Items the list does not show stay relevant at their known grade, so `unseen` keeps recall honest.
 */
export function relevantGrades(ranked: number[], unseen: number[] = []): number[] {
  return [...ranked.filter((g) => g > 0), ...unseen]
}
