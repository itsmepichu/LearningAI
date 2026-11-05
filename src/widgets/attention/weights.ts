/** Attention weights: a real softmax over hand-designed scores. They are not from a trained model. Pure. */
export const TOKENS = ['The', 'server', 'that', 'crashed', 'restarted']

export const HEADS = ['“previous word”', '“find the noun”', '“attend to self”']

type Score = (query: number, key: number) => number
const SCORES: Score[] = [
  (i, j) => (j === i - 1 ? 3 : j === i ? 1.2 : 0),
  (i, j) => (j === 1 ? (i >= 2 ? 3 : 1.5) : j === i ? 0.8 : 0),
  (i, j) => (j === i ? 3 : 0),
]

/** One row per query token. With the causal mask, a token cannot attend to later tokens. */
export function attentionWeights(head: number, causal: boolean, scale: number): number[][] {
  return TOKENS.map((_, i) => {
    const scores = TOKENS.map((_, j) => (causal && j > i ? -Infinity : (SCORES[head](i, j) * scale) / 3))
    const top = Math.max(...scores)
    const exp = scores.map((v) => (v === -Infinity ? 0 : Math.exp(v - top)))
    const sum = exp.reduce((a, b) => a + b, 0)
    return exp.map((v) => v / sum)
  })
}

/** Where a row's attention goes, largest first, leaving out anything below 0.5%. */
export function describeRow(row: number[]): { token: string; weight: number }[] {
  return row
    .map((weight, j) => ({ token: TOKENS[j], weight }))
    .filter((x) => x.weight > 0.005)
    .sort((a, b) => b.weight - a.weight)
}
