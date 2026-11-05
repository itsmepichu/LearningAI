/**
 * 5.3: one pre-norm decoder block, exploded into floors, one per stage, so the third axis is the order of operations
 * and each floor's width is its tensor's width. Every number is a real forward pass of a tiny block (RMSNorm, causal
 * multi-head attention, SwiGLU FFN, two residual adds) with random weights from a seed. Pure.
 */
import { TOKENS } from '../attention/weights.ts'
import {
  add, causal, colourScale, cols, concatCols, flat, fmt2, hadamard, labelAbove, map, matmul, randn, rmsNorm, rowRms, seeded, silu, softmaxRows, transpose,
  type Mat, type SceneStep, type TensorView, type Vec3,
} from '../scene3d/tensor.ts'

export const N = TOKENS.length
export const D = 8
export const F = 24
export const HEADS = 2
const DH = D / HEADS
/** Height between floors. */
const FLOOR = 1.5

export interface BlockPass {
  x: Mat
  n1: Mat
  attn: Mat
  h: Mat
  n2: Mat
  /** silu(gate) ⊙ up, the FFN's wide hidden layer. */
  u: Mat
  ffn: Mat
  out: Mat
}

/** One forward pass. Weights come from the seed; `input` replaces the seeded input, keeping the same weights. */
export function forward(seed: number, input?: Mat): BlockPass {
  const r = seeded(seed)
  const w = (i: number, o: number) => randn(r, i, o, 1 / Math.sqrt(i))
  const [wq, wk, wv, wo] = [w(D, D), w(D, D), w(D, D), w(D, D)]
  const [wg, wu, wd] = [w(D, F), w(D, F), w(F, D)]
  const x = input ?? randn(r, N, D)
  const n1 = rmsNorm(x)
  const [q, k, v] = [wq, wk, wv].map((m) => matmul(n1, m))
  const heads = Array.from({ length: HEADS }, (_, hd) => {
    const [qh, kh, vh] = [q, k, v].map((m) => cols(m, hd * DH, (hd + 1) * DH))
    const a = softmaxRows(causal(matmul(qh, transpose(kh)).map((row) => row.map((s) => s / Math.sqrt(DH)))))
    return matmul(a, vh)
  })
  const attn = matmul(concatCols(heads), wo)
  const h = add(x, attn)
  const n2 = rmsNorm(h)
  const u = hadamard(map(matmul(n2, wg), silu), matmul(n2, wu))
  const ffn = matmul(u, wd)
  return { x, n1, attn, h, n2, u, ffn, out: add(h, ffn) }
}

/** Parameters of each sub-layer, with no biases, as in the 5.3 tracer. `kv` is the number of key/value heads. */
export function blockParams(c: { d: number; heads: number; kv: number; ffn: number }) {
  const kvWidth = (c.d / c.heads) * c.kv
  const norm = c.d
  const attention = c.d * c.d * 2 + c.d * kvWidth * 2
  const ffn = 3 * c.d * c.ffn
  return { norm, attention, ffn, total: 2 * norm + attention + ffn }
}

export const LLAMA_8B_LIKE = { d: 4096, heads: 32, kv: 8, ffn: 14336 }
const DEMO = { d: D, heads: HEADS, kv: HEADS, ffn: F }

const millions = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n.toLocaleString('en-US'))
const range = (vs: number[]) => `${fmt2(Math.min(...vs))} to ${fmt2(Math.max(...vs))}`

export function blockSteps(seed: number): SceneStep[] {
  const p = forward(seed)
  const scale = colourScale([p.x, p.attn, p.h, p.ffn, p.out, p.n1, p.n2])
  const uScale = colourScale([p.u])
  const demo = blockParams(DEMO)
  const big = blockParams(LLAMA_8B_LIKE)
  // Floors are centred on x = 0, so the wide FFN floor sticks out on both sides.
  const at = (floor: number, width: number): Vec3 => [-((width - 1) * 0.26) / 2, floor * FLOOR, -((N - 1) * 0.26) / 2]
  const floor = (id: string, i: number, label: string, m: Mat, faded: boolean, s = scale): TensorView => {
    const o = at(i, m[0].length)
    return { id, label, shape: `${N} tokens × ${m[0].length}`, kind: 'value', cells: flat(m, o), slices: [m], labelAt: labelAbove(o, m[0].length, 0.28), scale: s, faded }
  }
  const FLOORS: [string, string, Mat, number?][] = [
    ['x', 'x, the residual stream', p.x],
    ['n1', 'RMSNorm(x)', p.n1],
    ['attn', 'Attention', p.attn],
    ['h', 'h = x + attention', p.h],
    ['n2', 'RMSNorm(h)', p.n2],
    ['u', 'FFN hidden: SiLU(gate) ⊙ up', p.u, uScale],
    ['ffn', 'FFN output', p.ffn],
    ['out', 'out = h + FFN', p.out],
  ]
  const upTo = (last: number) => FLOORS.slice(0, last + 1).map(([id, label, m, s], i) => floor(id, i, label, m, i < last, s))
  // The residual stream leaves each floor it skips from at its left edge, runs up the side, and rejoins at the add.
  const side = -((F - 1) * 0.26) / 2 - 0.6
  const edge = -((D - 1) * 0.26) / 2 - 0.15
  const hop = (from: number, to: number): Vec3[] => [[edge, from * FLOOR, 0], [side, from * FLOOR, 0], [side, to * FLOOR, 0], [edge, to * FLOOR, 0]]
  const residual = (last: number) => {
    if (last < 3) return []
    const pts = last >= 7 ? [...hop(0, 3), ...hop(3, 7)] : hop(0, 3)
    return [{ id: 'residual', label: 'residual stream', points: pts }]
  }
  const step = (i: number, title: string, text: string): SceneStep => ({
    title, text, tensors: upTo(i), paths: residual(i), target: [0, Math.max(0, i * FLOOR - 1.6), 0], distance: 6 + Math.min(i, 4) * 0.8,
  })

  return [
    step(0, 'The residual stream', `One vector of ${D} numbers per token, lying flat: tokens come towards you, features go across. This stream runs up through every block; each sub-layer reads it and adds its result back. A real 8B model has ${LLAMA_8B_LIKE.d} features per token.`),
    step(1, 'Normalise', `RMSNorm divides each token's vector by its root-mean-square. Before, the rows' RMS ranged ${range(rowRms(p.x))}; now every row's RMS is ${fmt2(rowRms(p.n1)[0])}. A real model also multiplies by a learned gain (${millions(demo.norm)} numbers here, ${millions(big.norm)} in an 8B-like model).`),
    step(2, 'Attention mixes information between tokens', `Causal multi-head attention with ${HEADS} heads (5.2) reads the normalised vectors and writes a new ${N} × ${D} matrix. It is the only step that moves information between tokens. Its four weight matrices have ${millions(demo.attention)} parameters here, ${millions(big.attention)} in an 8B-like model with grouped-query attention.`),
    step(3, 'Add it back to the stream', `The attention output is added to x rather than replacing it: h = x + attention. That residual connection, the line on the left, gives gradients a direct path through every block, which is what lets models stack dozens of them.`),
    step(4, 'Normalise again', `A second RMSNorm, before the feed-forward network. Every row's RMS is ${fmt2(rowRms(p.n2)[0])} again.`),
    step(5, 'Expand: the FFN’s wide hidden layer', `Each token's vector is projected to ${F} numbers twice, a gate and an up projection, and combined as SiLU(gate) ⊙ up (SwiGLU). This floor is ${F / D}× wider: the third axis shows where the computation happens, and its width shows why it costs the most. Each token is transformed on its own; nothing moves between tokens here.`),
    step(6, 'Project back', `A down projection returns to ${D} numbers per token. The FFN's three matrices hold ${millions(demo.ffn)} parameters here and ${millions(big.ffn)} in an 8B-like model: ${Math.round((big.ffn / big.total) * 100)}% of the block, against ${Math.round((big.attention / big.total) * 100)}% for attention.`),
    step(7, 'Add back again, and on to the next block', `out = h + FFN: the second residual add. The output has the input's shape, ${N} × ${D}, so it becomes the next block's x. An 8B-like model repeats this ${32} times, ${millions(big.total)} parameters per block.`),
  ]
}
