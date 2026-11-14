export const TOKENS = ['␣strong', '␣solid', '␣better', '␣disappointing', '␣mixed', '␣record', '␣in', '␣flat', '␣excellent', '␣bananas']
export const LOGITS = [3.2, 2.6, 2.2, 1.9, 1.7, 1.4, 1.0, 0.8, 0.6, -1.5]

export interface Cand { index: number; before: number; after: number }

/** Softmax at temperature `t`, then top-k and top-p (nucleus) filtering, then renormalising. Sorted from most to least likely. */
export function candidates(t: number, k: number, p: number): Cand[] {
  const T = Math.max(0.05, t)
  const z = LOGITS.map((v) => v / T)
  const m = Math.max(...z)
  const e = z.map((v) => Math.exp(v - m))
  const s = e.reduce((a, b) => a + b, 0)
  const pr = e.map((v) => v / s)
  const order = pr.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0])
  const keep = new Set<number>()
  let cum = 0
  order.forEach(([v, i], rank) => {
    if (rank < k && cum < p - 1e-9) {
      keep.add(i)
      cum += v
    }
  })
  const kept = order.filter(([, i]) => keep.has(i)).reduce((a, [v]) => a + v, 0)
  return order.map(([v, i]) => ({ index: i, before: v, after: keep.has(i) ? v / kept : 0 }))
}

/** Draws `n` samples from the filtered distribution and counts them by token. `rand` returns a number in [0, 1). */
export function sample(c: Cand[], n: number, rand: () => number): [string, number][] {
  const live = c.filter((d) => d.after > 0)
  const counts = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    let u = rand()
    let pick = live[0]
    for (const d of live) {
      u -= d.after
      if (u <= 0) {
        pick = d
        break
      }
    }
    const tok = TOKENS[pick.index]
    counts.set(tok, (counts.get(tok) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}
