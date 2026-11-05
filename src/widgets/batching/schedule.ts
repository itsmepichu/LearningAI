/** Static and continuous batching over the same requests. Each grid row is a decode step; -1 is an idle slot. Pure. */
import { mulberry } from '../kit/random.ts'

export type Scheduler = 'static' | 'continuous'
export const SLOTS = 4
export const REQUESTS = 12

export function requestLengths(seed = 9): number[] {
  const r = mulberry(seed)
  return Array.from({ length: REQUESTS }, () => 3 + Math.floor(r() * 14))
}

export function schedule(mode: Scheduler, lengths: number[], slots = SLOTS): number[][] {
  const grid: number[][] = []
  if (mode === 'static') {
    // A batch finishes only when its longest request does, and early finishers hold their slots.
    for (let b = 0; b < lengths.length; b += slots) {
      const batch = lengths.slice(b, b + slots)
      const longest = Math.max(...batch)
      for (let k = 0; k < longest; k++) {
        const row = batch.map((l, i) => (k < l ? b + i : -1))
        while (row.length < slots) row.push(-1)
        grid.push(row)
      }
    }
    return grid
  }
  // A freed slot takes the next waiting request at the next step.
  const queue = lengths.map((length, id) => ({ id, length }))
  const active: ({ id: number; left: number } | null)[] = Array(slots).fill(null)
  while (queue.length || active.some(Boolean)) {
    for (let s = 0; s < slots; s++) {
      if (!active[s] && queue.length) {
        const next = queue.shift()!
        active[s] = { id: next.id, left: next.length }
      }
    }
    grid.push(active.map((a) => (a ? a.id : -1)))
    active.forEach((a, s) => {
      if (a && --a.left <= 0) active[s] = null
    })
  }
  return grid
}

export function utilisation(grid: number[][]): number {
  if (!grid.length) return 0
  const busy = grid.reduce((n, row) => n + row.filter((v) => v >= 0).length, 0)
  return busy / (grid.length * grid[0].length)
}
