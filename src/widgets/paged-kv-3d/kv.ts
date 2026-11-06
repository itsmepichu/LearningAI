/**
 * 14.3: the paged KV cache of the 2D figure above (paged-kv/pool.ts), with the layers drawn as the third axis. One
 * block table serves every layer: a block reserved for a sequence holds that sequence's keys and values in all of
 * them, so the cache grows by layers × heads × head size for each token. Each cube is one token slot in one layer. Pure.
 */
import { BLOCK_SIZE, POOL_BLOCKS, blocksInUse, initPool, stepPool, type Owner, type Pool } from '../paged-kv/pool.ts'
import type { BarView, SceneStep, Tone, Vec3 } from '../scene3d/tensor.ts'

/** Layers drawn: the first two and the last, standing for all of them. */
const LAYERS = ['layer 1', 'layer 2', 'layer 32']
const X = 0.42
const Y = 0.3
const Z = 1.6
const CUBE = 0.3
export const MAX_STEPS = 8

const TONE: Record<Owner, Tone> = { shared: 'sim', A: 'accent', B: 'signal', C: 'ok' }

/** An 8B-like model with grouped-query attention: 32 layers, 8 key/value heads of 128, 2-byte numbers. */
export const MODEL = { layers: 32, kvHeads: 8, headDim: 128, bytes: 2 }
/** Keys and values for one token in one layer, and across all layers. */
export const perTokenLayer = 2 * MODEL.kvHeads * MODEL.headDim * MODEL.bytes
export const perToken = perTokenLayer * MODEL.layers

export function pools(share: boolean): Pool[] {
  const out = [initPool(share)]
  while (out.length <= MAX_STEPS && blocksInUse(out[out.length - 1]) < POOL_BLOCKS) out.push(stepPool(out[out.length - 1]))
  return out
}

const kib = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(b % 1048576 ? 1 : 0)} MiB` : `${Math.round(b / 1024)} KiB`)

export function kvSteps(share: boolean): SceneStep[] {
  const states = pools(share)
  const x0 = (-(POOL_BLOCKS - 1) * X) / 2
  return states.map((p, i): SceneStep => {
    const bars: BarView[] = []
    LAYERS.forEach((_, l) => {
      p.blocks.forEach((b, k) => {
        for (let slot = 0; slot < BLOCK_SIZE; slot++) {
          const at: Vec3 = [x0 + k * X, slot * Y, -l * Z]
          const id = `l${l}-b${k}-s${slot}`
          if (!b) bars.push({ id, at, size: [CUBE, CUBE * 0.8, CUBE], tone: 'muted', faded: true })
          else bars.push({ id, at, size: [CUBE, CUBE * 0.8, CUBE], tone: TONE[b.owner], faded: slot >= b.used })
        }
      })
    })
    const used = blocksInUse(p)
    const tokens = p.blocks.reduce((s, b) => s + (b ? b.used : 0), 0)
    const slots = used * BLOCK_SIZE
    const stored = p.sequences.reduce((s, q) => s + q.tokens, 0)
    const sharedBlocks = p.blocks.filter((b) => b?.owner === 'shared').length
    const full = used >= POOL_BLOCKS
    const text =
      (i === 0
        ? `Three sequences, A, B and C, each start with an 8-token system prompt and their own first tokens. ${share ? `The prompt's ${sharedBlocks} blocks are stored once and pointed to by all three block tables.` : 'Each stores its own copy of the system prompt.'} `
        : `Every sequence adds one token, filling its last block or taking a new one from the pool. `) +
      `${used} of ${POOL_BLOCKS} blocks are in use, holding ${tokens} token slots of ${slots} reserved (the unfilled slots, drawn faint, are the only waste: at most one partly filled block per sequence). ` +
      `The sequences see ${stored} tokens of context${share && stored > tokens ? `, more than the ${tokens} stored, because the prompt is shared` : ''}. ` +
      (i === 0 || i === states.length - 1
        ? `Each block exists in every layer, so for an 8B-like model each token slot costs ${kib(perTokenLayer)} per layer and ${kib(perToken)} across ${MODEL.layers} layers: these ${tokens} tokens take ${kib(tokens * perToken)}.`
        : '') +
      (full ? ' The pool is now full: a new token must wait, or a sequence is preempted and its blocks freed.' : '')
    return {
      title: i === 0 ? 'Three sequences start' : `Decode step ${p.step}${full ? ': the pool is full' : ''}`,
      text,
      tensors: [],
      bars,
      notes: [
        ...LAYERS.map((name, l) => ({ id: `layer-${l}`, at: [x0 - 1.5, 0.3, -l * Z] as Vec3, text: name })),
        ...(i === 0 ? [{ id: 'blk', at: [x0, -0.35, 0.3] as Vec3, text: 'block #0' }, { id: 'blk-last', at: [x0 + (POOL_BLOCKS - 1) * X, -0.35, 0.3] as Vec3, text: `#${POOL_BLOCKS - 1}` }] : []),
      ],
      target: [0, 0.5, -Z],
      distance: 11.5,
      table: {
        caption: `Block tables after ${i === 0 ? 'the prompts' : `decode step ${p.step}`}: the same table indexes every layer`,
        head: ['Sequence', 'Tokens', 'Physical blocks'],
        rows: [...p.sequences.map((q) => [q.name, q.tokens, q.blocks.join(', ')]), ['Pool', `${tokens} stored`, `${used} of ${POOL_BLOCKS} blocks in use`]],
      },
    }
  })
}
