export const PROMPT = 'The invoice is due on'
/** Illustrative next-token probabilities: the three best candidates at each step; greedy decoding takes the first. */
export const STEPS: { token: string; top: [string, number][] }[] = [
  { token: ' the', top: [[' the', 0.46], [' March', 0.18], [' or', 0.09]] },
  { token: ' 15th', top: [[' 15th', 0.31], [' 1st', 0.22], [' last', 0.12]] },
  { token: ' of', top: [[' of', 0.88], [' day', 0.04], [',', 0.03]] },
  { token: ' March', top: [[' March', 0.29], [' each', 0.24], [' every', 0.11]] },
  { token: '.', top: [['.', 0.71], [' 2027', 0.12], [',', 0.08]] },
  { token: '⟨eos⟩', top: [['⟨eos⟩', 0.64], [' Please', 0.2], [' Late', 0.06]] },
]
