/** Number with a fixed count of decimals, grouped the way the rest of the course shows numbers. */
export function fmt(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '∞'
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
}

export const pct = (ratio: number, decimals = 0) => `${fmt(ratio * 100, decimals)}%`

export function usd(n: number): string {
  if (n >= 1e6) return `$${fmt(n / 1e6, 2)}M`
  if (n >= 1000) return `$${fmt(n)}`
  if (n >= 1) return `$${fmt(n, 2)}`
  return `$${fmt(n, 4)}`
}

export function compact(n: number): string {
  if (n >= 1e6) return `${fmt(n / 1e6, 1)}M`
  if (n >= 1000) return `${fmt(n / 1000, 1)}k`
  return fmt(n)
}
