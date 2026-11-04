/**
 * A 2-parameter loss surface and three real optimizers (plain SGD, momentum, Adam).
 * The gradient is exact (analytic); "mini-batch noise" adds Gaussian noise to it,
 * which is what sampling a batch instead of the full dataset does to a real gradient.
 */

// Wide bowl with its global minimum at the origin, plus a small local basin on the slope.
const G = 1.5, GS = 1.6
const L = 0.75, LX = 2.0, LY = -1.15, LS = 0.3

export const DOMAIN = 3.6

export function loss(x: number, y: number): number {
  return 0.07 * x * x + 0.6 * y * y - G * Math.exp(-(x * x + y * y) / GS) - L * Math.exp(-((x - LX) ** 2 + (y - LY) ** 2) / LS)
}

export function grad(x: number, y: number): [number, number] {
  const e1 = Math.exp(-(x * x + y * y) / GS)
  const e2 = Math.exp(-((x - LX) ** 2 + (y - LY) ** 2) / LS)
  return [
    0.14 * x + ((G * e1 * 2) / GS) * x + ((L * e2 * 2) / LS) * (x - LX),
    1.2 * y + ((G * e1 * 2) / GS) * y + ((L * e2 * 2) / LS) * (y - LY),
  ]
}

export type OptName = 'sgd' | 'momentum' | 'adam'
export const OPTS: { id: OptName; label: string; rule: string }[] = [
  { id: 'sgd', label: 'SGD', rule: 'θ ← θ − η·g' },
  { id: 'momentum', label: 'Momentum', rule: 'v ← 0.9·v + g;  θ ← θ − η·v' },
  { id: 'adam', label: 'Adam', rule: 'm, s ← EMAs of g, g²;  θ ← θ − η·m̂/(√ŝ + ε)' },
]

export interface OptState {
  x: number
  y: number
  t: number
  vx: number
  vy: number
  mx: number
  my: number
  sx: number
  sy: number
  path: [number, number][]
  losses: number[]
  diverged: boolean
}

export const initState = (x: number, y: number): OptState => ({
  x, y, t: 0, vx: 0, vy: 0, mx: 0, my: 0, sx: 0, sy: 0, path: [[x, y]], losses: [loss(x, y)], diverged: false,
})

/** Seeded normal sampler so a run with noise is reproducible after Reset. */
export function makeNoise(seed: number) {
  let a = seed | 0
  const u = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return () => Math.sqrt(-2 * Math.log(u() || 1e-9)) * Math.cos(2 * Math.PI * u())
}

export function step(s: OptState, kind: OptName, lr: number, noise: number, rnd: () => number): OptState {
  if (s.diverged) return s
  let [gx, gy] = grad(s.x, s.y)
  if (noise > 0) {
    gx += noise * rnd()
    gy += noise * rnd()
  }
  const n = { ...s, t: s.t + 1 }
  if (kind === 'sgd') {
    n.x -= lr * gx
    n.y -= lr * gy
  } else if (kind === 'momentum') {
    n.vx = 0.9 * s.vx + gx
    n.vy = 0.9 * s.vy + gy
    n.x -= lr * n.vx
    n.y -= lr * n.vy
  } else {
    n.mx = 0.9 * s.mx + 0.1 * gx
    n.my = 0.9 * s.my + 0.1 * gy
    n.sx = 0.999 * s.sx + 0.001 * gx * gx
    n.sy = 0.999 * s.sy + 0.001 * gy * gy
    const b1 = 1 - 0.9 ** n.t, b2 = 1 - 0.999 ** n.t
    n.x -= (lr * (n.mx / b1)) / (Math.sqrt(n.sx / b2) + 1e-8)
    n.y -= (lr * (n.my / b1)) / (Math.sqrt(n.sy / b2) + 1e-8)
  }
  if (!isFinite(n.x) || !isFinite(n.y) || Math.abs(n.x) > DOMAIN * 2.5 || Math.abs(n.y) > DOMAIN * 2.5) {
    return { ...n, diverged: true }
  }
  n.path = [...s.path, [n.x, n.y]]
  n.losses = [...s.losses, loss(n.x, n.y)]
  return n
}

/** Marching squares: iso-lines of the loss on a grid, as flat segment lists in (x, y). */
export function contours(levels: number[], res = 90): Float32Array[] {
  const N = res, h = (2 * DOMAIN) / N
  const v: number[] = []
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) v.push(loss(-DOMAIN + i * h, -DOMAIN + j * h))
  const at = (i: number, j: number) => v[j * (N + 1) + i]
  return levels.map((lv) => {
    const seg: number[] = []
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1)
        const x0 = -DOMAIN + i * h, y0 = -DOMAIN + j * h
        const pts: number[] = []
        const edge = (p: number, q: number, ax: number, ay: number, bx: number, by: number) => {
          if ((p < lv) !== (q < lv)) {
            const t = (lv - p) / (q - p)
            pts.push(ax + t * (bx - ax), ay + t * (by - ay))
          }
        }
        edge(a, b, x0, y0, x0 + h, y0)
        edge(b, c, x0 + h, y0, x0 + h, y0 + h)
        edge(c, d, x0 + h, y0 + h, x0, y0 + h)
        edge(d, a, x0, y0 + h, x0, y0)
        if (pts.length >= 4) seg.push(pts[0], pts[1], pts[2], pts[3])
        if (pts.length === 8) seg.push(pts[4], pts[5], pts[6], pts[7])
      }
    return new Float32Array(seg)
  })
}
