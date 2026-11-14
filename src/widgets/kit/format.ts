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

/** A short count: 1.2k, 3.4M, 8.0B, 1.2T. Below a thousand it keeps the decimals only for numbers under ten. */
export function si(n: number, decimals = 1): string {
  const a = Math.abs(n)
  if (a >= 1e12) return `${fmt(n / 1e12, decimals)}T`
  if (a >= 1e9) return `${fmt(n / 1e9, decimals)}B`
  if (a >= 1e6) return `${fmt(n / 1e6, decimals)}M`
  if (a >= 1e3) return `${fmt(n / 1e3, decimals)}k`
  return fmt(n, a < 10 && decimals ? decimals : 0)
}

/** A byte count in decimal units: 4.7 GB, 812 MB. */
export function bytesText(b: number): string {
  if (b >= 1e12) return `${fmt(b / 1e12, 2)} TB`
  if (b >= 1e9) return `${fmt(b / 1e9, b >= 1e11 ? 0 : 1)} GB`
  if (b >= 1e6) return `${fmt(b / 1e6, 1)} MB`
  if (b >= 1e3) return `${fmt(b / 1e3, 1)} KB`
  return `${fmt(b)} B`
}
