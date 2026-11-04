/** Number with a fixed count of decimals, grouped the way the rest of the course shows numbers. */
export function fmt(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '∞'
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
}

export const pct = (ratio: number, decimals = 0) => `${fmt(ratio * 100, decimals)}%`
