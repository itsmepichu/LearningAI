export interface VectorInput { angleA: number; angleB: number; lenA: number; lenB: number }
export type Vec = [number, number]

/** Two arrows from the origin, their dot product, cosine, angle and the projection of a onto b. Lengths are in pixels; 100 px is one unit. */
export function vectors({ angleA, angleB, lenA, lenB }: VectorInput) {
  const a = (angleA * Math.PI) / 180
  const b = (angleB * Math.PI) / 180
  const A: Vec = [lenA * Math.cos(a), lenA * Math.sin(a)]
  const B: Vec = [lenB * Math.cos(b), lenB * Math.sin(b)]
  const dot = A[0] * B[0] + A[1] * B[1]
  const cos = dot / (lenA * lenB)
  const k = dot / (lenB * lenB)
  const P: Vec = [B[0] * k, B[1] * k]
  const angle = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
  return { A, B, P, dot, cos, angle, projection: dot / lenB }
}
export const UNIT = 100
