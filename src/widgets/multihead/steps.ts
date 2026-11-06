/**
 * 5.2: multi-head self-attention, step by step, as tensors in 3D. Every number is real arithmetic: X is a random token
 * matrix and W_Q, W_K, W_V, W_O are random weights from a seed, so the shapes and the operations are exact, while the
 * attention patterns are arbitrary. The figure above it shows hand-designed heads with recognisable patterns. Pure.
 */
import { TOKENS } from '../attention/weights.ts'
import {
  causal, colourScale, concatCols, cols, groupsOf, labelAbove, matmul, pct, randn, seeded, softmaxRows, split, stacked, transpose, upright,
  type Mat, type SceneStep, type TensorView, type Vec3,
} from '../scene3d/tensor.ts'

export const N = TOKENS.length
export const D = 12
export const HEADS = 3
export const DH = D / HEADS
/** How far apart heads sit along the third axis. */
const DEPTH = 1.1

export interface Attention {
  x: Mat
  q: Mat
  k: Mat
  v: Mat
  /** Attention weights, one n × n matrix per head. */
  a: Mat[]
  /** Each head's output, n × d_head. */
  o: Mat[]
  concat: Mat
  y: Mat
}

/** One forward pass of causal multi-head self-attention on random inputs and weights. */
export function attend(seed: number): Attention {
  const r = seeded(seed)
  const x = randn(r, N, D)
  const w = () => randn(r, D, D, 1 / Math.sqrt(D))
  const [wq, wk, wv, wo] = [w(), w(), w(), w()]
  const q = matmul(x, wq)
  const k = matmul(x, wk)
  const v = matmul(x, wv)
  const a: Mat[] = []
  const o: Mat[] = []
  for (let h = 0; h < HEADS; h++) {
    const [qh, kh, vh] = [q, k, v].map((m) => cols(m, h * DH, (h + 1) * DH))
    const scores = matmul(qh, transpose(kh)).map((row) => row.map((s) => s / Math.sqrt(DH)))
    a.push(softmaxRows(causal(scores)))
    o.push(matmul(a[h], vh))
  }
  const concat = concatCols(o)
  return { x, q, k, v, a, o, concat, y: matmul(concat, wo) }
}

const HEAD_NAMES = Array.from({ length: HEADS }, (_, h) => `head ${h + 1}`)
const shape = (rows: number, c: number) => `${rows} tokens × ${c}`

/** Which earlier token the last token attends to most, in each head. */
export function lastTokenFocus(a: Mat[]) {
  return a.map((m) => {
    const row = m[N - 1]
    const j = row.indexOf(Math.max(...row))
    return { token: TOKENS[j], weight: row[j] }
  })
}

export function multiheadSteps(seed: number): SceneStep[] {
  const t = attend(seed)
  const vs = colourScale([t.x, t.q, t.k, t.v])
  const os = colourScale([...t.o, t.y])
  const X: Vec3 = [-5.2, 0.6, 0]
  const Q: Vec3 = [-1.2, 2.6, 0]
  const K: Vec3 = [-1.2, 0.6, 0]
  const V: Vec3 = [-1.2, -1.4, 0]
  const A: Vec3 = [2.8, 0.6, 0]
  const O: Vec3 = [5.4, 0.6, 0]
  const Y: Vec3 = [9.2, 0.6, 0]
  const above = (p: Vec3, columns = D): Vec3 => labelAbove(p, columns)

  const tx = (faded = false): TensorView => ({
    id: 'x', label: 'X, token vectors', shape: shape(N, D), kind: 'value', cells: upright(t.x, X), slices: [t.x], labelAt: above(X), scale: vs, faded,
  })
  const qkv = (heads: boolean, faded = false): TensorView[] =>
    ([['q', 'Q', t.q, Q], ['k', 'K', t.k, K], ['v', 'V', t.v, V]] as const).map(([id, name, m, at]) => ({
      id, kind: 'value', scale: vs, faded, labelAt: above(at, heads ? DH : D),
      label: heads ? `${name}, split into ${HEADS} heads` : `${name} = X · W${name}`,
      shape: heads ? `${HEADS} heads × ${N} × ${DH}` : shape(N, D),
      cells: heads ? split(m, HEADS, at, DEPTH) : upright(m, at),
      slices: heads ? groupsOf(m, HEADS) : [m],
      sliceNames: heads ? HEAD_NAMES : undefined,
    }))
  const ta = (faded = false): TensorView => ({
    id: 'a', label: 'Attention weights', shape: `${HEADS} heads × ${N} × ${N}`, kind: 'weight', cells: stacked(t.a, A, DEPTH), slices: t.a, sliceNames: HEAD_NAMES, labelAt: above(A, N), scale: 1, faded,
  })
  const to = (merged: boolean, faded = false): TensorView => ({
    id: 'o', kind: 'value', scale: os, faded, labelAt: above(O, merged ? D : DH),
    label: merged ? 'Heads concatenated' : 'Each head’s output',
    shape: merged ? shape(N, D) : `${HEADS} heads × ${N} × ${DH}`,
    // The concatenated matrix's cells in row-major order: merged they sit side by side, unmerged in their heads.
    cells: merged ? upright(t.concat, O) : split(t.concat, HEADS, O, DEPTH),
    slices: merged ? [t.concat] : t.o,
    sliceNames: merged ? undefined : HEAD_NAMES,
  })
  const ty: TensorView = { id: 'y', label: 'Output = concat · W_O', shape: shape(N, D), kind: 'value', cells: upright(t.y, Y), slices: [t.y], labelAt: above(Y), scale: os }

  const focus = lastTokenFocus(t.a)
    .map((f, h) => `in head ${h + 1}, “${TOKENS[N - 1]}” puts ${pct(f.weight)} of its weight on “${f.token}”`)
    .join('; ')
  const diag = (m: Mat) => m[0][0]

  return [
    {
      title: 'One vector per token',
      text: `The input is a matrix X: one row of ${D} numbers for each of the ${N} tokens of “${TOKENS.join(' ')}”. In a real model the rows are embeddings with position information, thousands of numbers wide.`,
      tensors: [tx()],
      target: [X[0] + 1.4, 0, 0], distance: 6.5,
    },
    {
      title: 'Project to queries, keys and values',
      text: `Three matrix multiplies, X·W_Q, X·W_K and X·W_V, turn every token's vector into a query, a key and a value at once. Each weight matrix is ${D} × ${D}, so Q, K and V keep X's shape.`,
      tensors: [tx(), ...qkv(false)],
      target: [-2, 0.6, 0], distance: 10,
    },
    {
      title: `Split into ${HEADS} heads`,
      text: `Each of Q, K and V is cut along its columns into ${HEADS} heads of ${DH} numbers, and the heads are laid one behind another. This third axis is the head: from here on, every head works on its own ${N} × ${DH} slice, in parallel, with no extra weights.`,
      tensors: [tx(true), ...qkv(true)],
      target: [-0.6, 0.6, -1.1], distance: 9,
    },
    {
      title: 'Score every query against every key, in each head',
      text: `In each head, every query is compared with every key by dot product and divided by √${DH}, giving an ${N} × ${N} score matrix per head. Scores above the diagonal are set to −∞ (the causal mask), and a softmax turns each row into weights that sum to 1. With these random weights, ${focus}. The first token can only attend to itself, so its weight is ${pct(diag(t.a[0]))} in every head.`,
      tensors: [tx(true), ...qkv(true, true), ta()],
      target: [3.4, 0.2, -1.1], distance: 8.5,
    },
    {
      title: 'Weighted sum of the values',
      text: `Each head multiplies its weights (${N} × ${N}) by its values (${N} × ${DH}): every token's output is a weighted average of the value vectors it attends to. The result is one ${N} × ${DH} output per head.`,
      tensors: [tx(true), ...qkv(true, true), ta(true), to(false)],
      target: [4.6, 0.2, -1.1], distance: 9,
    },
    {
      title: 'Concatenate the heads and mix them',
      text: `The ${HEADS} head outputs are laid side by side again, back to ${N} × ${D}, and one more ${D} × ${D} matrix, W_O, mixes what the heads found. The output has the input's shape, so it can be added back to the residual stream (5.3).`,
      tensors: [tx(true), ...qkv(true, true), ta(true), to(true), ty],
      target: [8.8, 0.2, 0], distance: 10,
    },
  ]
}
