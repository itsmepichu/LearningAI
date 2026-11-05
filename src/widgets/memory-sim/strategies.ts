/** What each memory strategy still has in context when a question is asked at a given turn. Pure. */
export type Kept = 'full' | 'gist' | 'lost'
export interface Fact {
  name: string
  /** The turn that states it. */
  turn: number
  /** What a rolling summary keeps once the turn leaves the window. */
  summary: 'full' | 'gist'
  /** Whether the extraction schema has a field for it, once the turn leaves the window. */
  store: 'full' | 'lost'
}
export interface FactRow {
  fullHistory: Kept
  window: Kept
  summary: Kept
  store: Kept
}

/** The window is the `k` turns before the question. The question itself is always in context. */
export const inWindow = (turn: number, question: number, k: number) => turn >= question - k && turn < question

/** Only facts stated before the question can matter to it. */
export const knownFacts = (facts: Fact[], question: number) => facts.filter((f) => f.turn < question)

export function factRow(fact: Fact, question: number, k: number): FactRow {
  const w = inWindow(fact.turn, question, k)
  return { fullHistory: 'full', window: w ? 'full' : 'lost', summary: w ? 'full' : fact.summary, store: w ? 'full' : fact.store }
}

const TOKENS_PER_TURN = 200
const SUMMARY_TOKENS = 300
const FACT_RECORD_TOKENS = 120

/** Approximate context cost of each strategy, at an illustrative 200 tokens per turn. */
export function contextTokens(question: number, k: number) {
  const recent = Math.min(k, question - 1) + 1
  return {
    fullHistory: question * TOKENS_PER_TURN,
    window: recent * TOKENS_PER_TURN,
    summary: SUMMARY_TOKENS + recent * TOKENS_PER_TURN,
    store: FACT_RECORD_TOKENS + recent * TOKENS_PER_TURN,
  }
}
