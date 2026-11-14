export const CELLS = 1000

export interface BayesInput { priorPerMille: number; recallPercent: number; fprPerMille: number }

/** Counts for 1,000 transactions: fraud caught, fraud missed, legitimate but flagged. */
export function bayesCounts({ priorPerMille, recallPercent, fprPerMille }: BayesInput) {
  const fraud = Math.round((CELLS * priorPerMille) / 1000)
  const caught = Math.round((fraud * recallPercent) / 100)
  const missed = fraud - caught
  const legit = CELLS - fraud
  const falseAlarms = Math.round((legit * fprPerMille) / 1000)
  const precision = caught + falseAlarms ? caught / (caught + falseAlarms) : 0
  return { fraud, caught, missed, falseAlarms, precision }
}

/** What each of the 1,000 squares shows, in order: caught, missed, false alarm, then everything else. */
export function cellKinds(c: ReturnType<typeof bayesCounts>): ('caught' | 'missed' | 'alarm' | 'rest')[] {
  return Array.from({ length: CELLS }, (_, i) => (i < c.caught ? 'caught' : i < c.fraud ? 'missed' : i < c.fraud + c.falseAlarms ? 'alarm' : 'rest'))
}
