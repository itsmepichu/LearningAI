/**
 * The shared model behind the 3D scenes: small matrix arithmetic, and the description of a scene as steps of tensors
 * whose cells have world positions. The 3D view, the 2D fallback and the text description are all drawn from the same
 * steps, so they cannot disagree. Pure, so a test can check the arithmetic and the layouts.
 */
import { gauss, mulberry } from '../kit/random.ts'

export type Mat = number[][]
export type Vec3 = [number, number, number]

// ---- Arithmetic ------------------------------------------------------------------------------------------------------

/** A rows × cols matrix of normal samples with standard deviation `scale`, from a seeded generator. */
export function randn(r: () => number, rows: number, cols: number, scale = 1): Mat {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => gauss(r) * scale))
}

export const seeded = (seed: number) => mulberry(seed)

export function matmul(a: Mat, b: Mat): Mat {
  const inner = b.length
  if (a[0].length !== inner) throw new Error(`matmul: ${a.length}×${a[0].length} by ${b.length}×${b[0].length}`)
  return a.map((row) => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)))
}

export const transpose = (a: Mat): Mat => a[0].map((_, j) => a.map((row) => row[j]))
export const add = (a: Mat, b: Mat): Mat => a.map((row, i) => row.map((v, j) => v + b[i][j]))
export const hadamard = (a: Mat, b: Mat): Mat => a.map((row, i) => row.map((v, j) => v * b[i][j]))
export const map = (a: Mat, f: (v: number) => number): Mat => a.map((row) => row.map(f))
export const cols = (a: Mat, from: number, to: number): Mat => a.map((row) => row.slice(from, to))
export const concatCols = (parts: Mat[]): Mat => parts[0].map((_, i) => parts.flatMap((p) => p[i]))

/** Sets every score above the diagonal to −∞, so a token cannot attend to a later one. */
export const causal = (scores: Mat): Mat => scores.map((row, i) => row.map((v, j) => (j > i ? -Infinity : v)))

export function softmaxRows(a: Mat): Mat {
  return a.map((row) => {
    const top = Math.max(...row)
    const e = row.map((v) => (v === -Infinity ? 0 : Math.exp(v - top)))
    const sum = e.reduce((s, v) => s + v, 0)
    return e.map((v) => v / sum)
  })
}

/** Root-mean-square of each row. */
export const rowRms = (a: Mat): number[] => a.map((row) => Math.sqrt(row.reduce((s, v) => s + v * v, 0) / row.length))

/** RMSNorm with unit gain: each row divided by its root-mean-square. */
export function rmsNorm(a: Mat, eps = 1e-6): Mat {
  return a.map((row) => {
    const rms = Math.sqrt(row.reduce((s, v) => s + v * v, 0) / row.length + eps)
    return row.map((v) => v / rms)
  })
}

export const silu = (v: number) => v / (1 + Math.exp(-v))

/** Largest absolute value, for colour scales. */
export const maxAbs = (ms: Mat[]): number => Math.max(1e-9, ...ms.flatMap((m) => m.flatMap((row) => row.map(Math.abs))))

/**
 * A colour scale that ignores the few largest values: the 90th percentile of absolute values. With the largest value
 * as the scale, one outlier would wash every other cell out.
 */
export function colourScale(ms: Mat[]): number {
  const all = ms.flatMap((m) => m.flatMap((row) => row.map(Math.abs))).sort((x, y) => x - y)
  return Math.max(1e-9, all[Math.min(all.length - 1, Math.floor(all.length * 0.9))])
}

/** Where a block's label goes: centred above the top edge of an upright block, or above the far edge of a flat one. */
export const labelAbove = (origin: Vec3, columns: number, lift = 0.5): Vec3 => [origin[0] + ((columns - 1) * PITCH) / 2, origin[1] + lift, origin[2]]

// ---- Scenes ----------------------------------------------------------------------------------------------------------

/**
 * `value` cells are signed activations, coloured on a diverging scale. `weight` cells are attention weights in 0..1,
 * coloured on a sequential scale.
 */
export type Kind = 'value' | 'weight'

export interface Cell {
  v: number
  at: Vec3
}

export interface TensorView {
  /** Stable across steps: a tensor that moves keeps its id and its cell order, so its cells can glide to new places. */
  id: string
  label: string
  /** Its shape in words, such as "5 tokens × 12". */
  shape: string
  kind: Kind
  /** One entry per logical cell, always in the same order for this id. */
  cells: Cell[]
  /** The same values as matrices, one per slice along the third axis, for the 2D view. */
  slices: Mat[]
  /** What each slice is, such as "head 1". Omitted for a single slice. */
  sliceNames?: string[]
  labelAt: Vec3
  /** Drawn faintly: context from earlier steps. */
  faded?: boolean
  /** The value that maps to the strongest colour. Shared between tensors that should be compared. */
  scale: number
}

export interface Path {
  id: string
  label: string
  points: Vec3[]
}

export interface SceneStep {
  title: string
  /** What happens in this step, in plain text: also the text description of the 3D view. */
  text: string
  tensors: TensorView[]
  paths?: Path[]
  /** Where the camera looks, and from how far. */
  target: Vec3
  distance: number
}

/** Distance between neighbouring cells. Cells are drawn a little smaller, so the grid shows. */
export const PITCH = 0.26
export const CELL = 0.21

/** A matrix as an upright slab facing the camera: rows go down, columns go right. */
export function upright(m: Mat, origin: Vec3, z = 0): Cell[] {
  return m.flatMap((row, r) => row.map((v, c): Cell => ({ v, at: [origin[0] + c * PITCH, origin[1] - r * PITCH, origin[2] + z] })))
}

/** A matrix lying flat at height y: columns go right, rows come towards the camera. */
export function flat(m: Mat, origin: Vec3): Cell[] {
  return m.flatMap((row, r) => row.map((v, c): Cell => ({ v, at: [origin[0] + c * PITCH, origin[1], origin[2] + r * PITCH] })))
}

/**
 * A matrix whose columns are split into equal groups (heads), each group pushed back along z by `depth`. Cells keep the
 * matrix's row-major order, so a tensor can glide between `upright` and `split`.
 */
export function split(m: Mat, groups: number, origin: Vec3, depth: number): Cell[] {
  const width = m[0].length / groups
  return m.flatMap((row, r) =>
    row.map((v, c): Cell => {
      const g = Math.floor(c / width)
      return { v, at: [origin[0] + (c % width) * PITCH, origin[1] - r * PITCH, origin[2] - g * depth] }
    }),
  )
}

/** Matrices stacked along z, one per slice, cells in slice → row → column order. */
export function stacked(ms: Mat[], origin: Vec3, depth: number): Cell[] {
  return ms.flatMap((m, s) => upright(m, origin, -s * depth))
}

/** Splits a matrix's columns into equal groups, for the 2D view of a split tensor. */
export const groupsOf = (m: Mat, groups: number): Mat[] => {
  const width = m[0].length / groups
  return Array.from({ length: groups }, (_, g) => cols(m, g * width, (g + 1) * width))
}

export const fmt2 = (v: number) => v.toFixed(2)
export const pct = (v: number) => `${Math.round(v * 100)}%`
