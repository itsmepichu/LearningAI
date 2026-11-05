/** A multi-server queue with random arrivals and service times, over five simulated minutes. Pure and seeded. */
import { exponential, mulberry } from '../kit/random.ts'

export const SIM_SECONDS = 300

export interface QueueRun {
  utilisation: number
  meanWait: number
  p95Wait: number
  /** Average in the system, measured from the run. */
  inSystem: number
  /** Little's law: arrival rate × (mean wait + mean service). */
  littles: number
  /** Requests waiting in each simulated second. */
  queue: number[]
}

export function simulateQueue(arrivalRate: number, servers: number, serviceTime: number, seed = 17): QueueRun {
  const r = mulberry(seed)
  const arrivals: number[] = []
  for (let t = exponential(r, 1 / arrivalRate); t < SIM_SECONDS; t += exponential(r, 1 / arrivalRate)) arrivals.push(t)
  const freeAt = new Array<number>(servers).fill(0)
  const queue = new Array<number>(SIM_SECONDS).fill(0)
  const waits: number[] = []
  let timeInSystem = 0
  for (const a of arrivals) {
    let k = 0
    for (let j = 1; j < servers; j++) if (freeAt[j] < freeAt[k]) k = j
    const start = Math.max(a, freeAt[k])
    const finish = start + exponential(r, serviceTime)
    freeAt[k] = finish
    waits.push(start - a)
    timeInSystem += finish - a
    for (let s = Math.floor(a); s < Math.min(SIM_SECONDS, Math.ceil(start)); s++) queue[s]++
  }
  const meanWait = waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0
  const sorted = [...waits].sort((a, b) => a - b)
  return {
    utilisation: (arrivalRate * serviceTime) / servers,
    meanWait,
    p95Wait: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    inSystem: timeInSystem / SIM_SECONDS,
    littles: arrivalRate * (meanWait + serviceTime),
    queue,
  }
}
