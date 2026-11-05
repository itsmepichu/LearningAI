/** Multi-window burn-rate alerting over a generated 30-day month of hourly error rates. Pure and seeded. */
import { mulberry } from '../kit/random.ts'

export const HOURS = 720
export const SCENARIOS = {
  spike: 'sharp incident (2 hours at 3% errors)',
  leak: 'slow leak (0.25% errors for 5 days)',
  flap: 'flapping (short 2% bursts)',
  calm: 'normal month',
} as const
export type Scenario = keyof typeof SCENARIOS
export type AlertKind = 'fast' | 'slow' | 'ticket'
export interface Alert {
  hour: number
  kind: AlertKind
}

/** Burn-rate thresholds: 1-hour for a fast page, 6-hour for a slow page, 3-day for a ticket. */
export const FAST_BURN = 14.4
export const SLOW_BURN = 6
export const TICKET_BURN = 1

export function errorRates(scenario: Scenario, budget: number, seed = 41): number[] {
  const r = mulberry(seed)
  return Array.from({ length: HOURS }, (_, h) => {
    let v = budget * 0.25 * (0.6 + r() * 0.8)
    if (scenario === 'spike' && h >= 400 && h < 402) v = 0.03
    if (scenario === 'leak' && h >= 200 && h < 320) v = 0.0025
    if (scenario === 'flap' && r() < 0.04) v = 0.02 * (0.5 + r())
    return v
  })
}

export function simulateBurn(scenario: Scenario, slo: number) {
  const budget = (100 - slo) / 100
  const errors = errorRates(scenario, budget)
  const windowBurn = (h: number, n: number) => {
    let sum = 0
    let count = 0
    for (let k = Math.max(0, h - n + 1); k <= h; k++) {
      sum += errors[k]
      count++
    }
    return sum / count / budget
  }
  const alerts: Alert[] = []
  const remaining: number[] = []
  let used = 0
  for (let h = 0; h < HOURS; h++) {
    used += errors[h] / (budget * HOURS)
    remaining.push(1 - used)
    const fast = windowBurn(h, 1) >= FAST_BURN
    const slow = windowBurn(h, 6) >= SLOW_BURN
    const ticket = windowBurn(h, 72) >= TICKET_BURN && windowBurn(h, 6) >= TICKET_BURN
    if (fast || slow || ticket) alerts.push({ hour: h, kind: fast ? 'fast' : slow ? 'slow' : 'ticket' })
  }
  return { budget, errors, burn: errors.map((e) => e / budget), alerts, remaining, used }
}

/** The day the first alert of a kind fires, or null if it never does. */
export function firstAlertDay(alerts: Alert[], kind: AlertKind): number | null {
  const a = alerts.find((x) => x.kind === kind)
  return a ? a.hour / 24 : null
}

/** One marker per kind per half day, because a long incident alerts every hour. */
export function alertMarkers(alerts: Alert[]): Alert[] {
  const seen = new Set<string>()
  return alerts.filter((a) => {
    const key = `${a.kind}-${Math.floor(a.hour / 12)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
