/** The Wilson 95% interval for a pass rate `p` observed on `n` cases, and its half-width. */
export function wilson(p: number, n: number, z = 1.96) {
  const den = 1 + (z * z) / n
  const centre = (p + (z * z) / (2 * n)) / den
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den
  return { low: centre - half, high: centre + half, half }
}
