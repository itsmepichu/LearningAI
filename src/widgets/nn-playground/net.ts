/** A small fully connected network (2 → H → H → 1) trained by full-batch backpropagation with momentum. Pure and seeded. */
import { gauss, mulberry } from '../kit/random.ts'

export type DataName = 'circle' | 'xor' | 'moons' | 'spiral'
export type ActName = 'tanh' | 'ReLU' | 'linear (no activation)'
export const DATASETS: { id: DataName; name: string }[] = [
  { id: 'circle', name: 'circles' },
  { id: 'xor', name: 'XOR quadrants' },
  { id: 'moons', name: 'two moons' },
  { id: 'spiral', name: 'spiral (hard)' },
]
export const ACTS: ActName[] = ['tanh', 'ReLU', 'linear (no activation)']
export type Pt = [number, number]

export function makeData(name: DataName): { points: Pt[]; labels: number[] } {
  const r = mulberry(5)
  const points: Pt[] = []
  const labels: number[] = []
  for (let i = 0; i < 240; i++) {
    let x: number
    let y: number
    let c: number
    if (name === 'circle') {
      const a = r() * 6.283
      const rad = r() < 0.5 ? r() * 0.45 : 0.65 + r() * 0.3
      c = rad < 0.5 ? 1 : 0
      x = Math.cos(a) * rad
      y = Math.sin(a) * rad
    } else if (name === 'xor') {
      x = r() * 2 - 1
      y = r() * 2 - 1
      c = x * y > 0 ? 1 : 0
      x += Math.sign(x) * 0.05
      y += Math.sign(y) * 0.05
    } else if (name === 'moons') {
      c = i % 2
      const a = r() * Math.PI
      x = c ? 1 - Math.cos(a) - 0.5 : Math.cos(a) - 0.5
      y = c ? 0.35 - Math.sin(a) + 0.15 : Math.sin(a) - 0.15
      x *= 0.75
      y *= 0.8
      x += gauss(r) * 0.07
      y += gauss(r) * 0.07
    } else {
      c = i % 2
      const t = ((i >> 1) / 120) * 3.2 + 0.25
      x = (t / 3.6) * Math.cos(t * 2.4 + c * Math.PI)
      y = (t / 3.6) * Math.sin(t * 2.4 + c * Math.PI)
      x += gauss(r) * 0.03
      y += gauss(r) * 0.03
    }
    points.push([x, y])
    labels.push(c)
  }
  return { points, labels }
}

interface Params { W1: number[][]; b1: number[]; W2: number[][]; b2: number[]; W3: number[]; b3: number }
export interface Net extends Params { H: number; act: ActName; v: Params; epoch: number }

const zeros = (p: Params): Params => ({ W1: p.W1.map((r) => r.map(() => 0)), b1: p.b1.map(() => 0), W2: p.W2.map((r) => r.map(() => 0)), b2: p.b2.map(() => 0), W3: p.W3.map(() => 0), b3: 0 })

export const paramCount = (H: number) => 2 * H + H + H * H + H + H + 1

export function initNet(H: number, act: ActName): Net {
  const r = mulberry(9)
  const mat = (a: number, b: number) => Array.from({ length: a }, () => Array.from({ length: b }, () => gauss(r) * Math.sqrt(1 / b)))
  const p: Params = { W1: mat(H, 2), b1: Array(H).fill(0), W2: mat(H, H), b2: Array(H).fill(0), W3: mat(1, H)[0], b3: 0 }
  return { ...p, H, act, v: zeros(p), epoch: 0 }
}

const f = (act: ActName, z: number) => (act === 'tanh' ? Math.tanh(z) : act === 'ReLU' ? Math.max(0, z) : z)
const df = (act: ActName, z: number, o: number) => (act === 'tanh' ? 1 - o * o : act === 'ReLU' ? (z > 0 ? 1 : 0) : 1)

export function forward(net: Net, x: Pt) {
  const z1 = net.W1.map((w, i) => w[0] * x[0] + w[1] * x[1] + net.b1[i])
  const h1 = z1.map((z) => f(net.act, z))
  const z2 = net.W2.map((w, i) => w.reduce((s, v, j) => s + v * h1[j], net.b2[i]))
  const h2 = z2.map((z) => f(net.act, z))
  const z3 = net.W3.reduce((s, v, j) => s + v * h2[j], net.b3)
  return { z1, h1, z2, h2, p: 1 / (1 + Math.exp(-z3)) }
}

/** One full-batch step with momentum 0.9. Returns the mean cross-entropy loss and the accuracy before the update. */
export function trainStep(net: Net, points: Pt[], labels: number[], lr: number): [number, number] {
  const H = net.H
  const g = zeros(net)
  let loss = 0
  let acc = 0
  points.forEach((x, n) => {
    const o = forward(net, x)
    const y = labels[n]
    loss -= y * Math.log(o.p + 1e-9) + (1 - y) * Math.log(1 - o.p + 1e-9)
    acc += o.p > 0.5 === !!y ? 1 : 0
    const d3 = o.p - y
    g.b3 += d3
    const d2 = o.h2.map((h, j) => {
      g.W3[j] += d3 * h
      return d3 * net.W3[j] * df(net.act, o.z2[j], h)
    })
    d2.forEach((d, i) => {
      g.b2[i] += d
      for (let j = 0; j < H; j++) g.W2[i][j] += d * o.h1[j]
    })
    const d1 = o.h1.map((h, j) => {
      let s = 0
      for (let i = 0; i < H; i++) s += d2[i] * net.W2[i][j]
      return s * df(net.act, o.z1[j], h)
    })
    d1.forEach((d, i) => {
      g.b1[i] += d
      g.W1[i][0] += d * x[0]
      g.W1[i][1] += d * x[1]
    })
  })
  const N = points.length
  const mo = 0.9
  const upd = (v: number, grad: number) => mo * v - (lr * grad) / N
  for (let i = 0; i < H; i++) {
    for (let k = 0; k < 2; k++) {
      net.v.W1[i][k] = upd(net.v.W1[i][k], g.W1[i][k])
      net.W1[i][k] += net.v.W1[i][k]
    }
    net.v.b1[i] = upd(net.v.b1[i], g.b1[i])
    net.b1[i] += net.v.b1[i]
    net.v.W3[i] = upd(net.v.W3[i], g.W3[i])
    net.W3[i] += net.v.W3[i]
    net.v.b2[i] = upd(net.v.b2[i], g.b2[i])
    net.b2[i] += net.v.b2[i]
    for (let j = 0; j < H; j++) {
      net.v.W2[i][j] = upd(net.v.W2[i][j], g.W2[i][j])
      net.W2[i][j] += net.v.W2[i][j]
    }
  }
  net.v.b3 = upd(net.v.b3, g.b3)
  net.b3 += net.v.b3
  net.epoch++
  return [loss / N, acc / N]
}
