/** Gradients each worker computes on its own batch (illustrative values), the learning rate and the starting weight. */
export const GRADS = [0.8, 1.2, 0.6, 1.4]
export const LR = 0.1
export const W0 = 2
export const LABELS = ['Replicas start identical', 'Each worker computes a gradient on its own batch', 'All-reduce: sum the gradients across workers', 'Average: divide by 4', 'Every worker applies the same update']

export function state(stage: number) {
  const sum = GRADS.reduce((a, b) => a + b, 0)
  const avg = sum / GRADS.length
  return { sum, avg, w: stage >= 4 ? W0 - LR * avg : W0 }
}
