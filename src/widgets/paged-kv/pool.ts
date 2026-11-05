/** A paged KV cache: a fixed pool of blocks, allocated as sequences grow, with optional prefix sharing. Pure. */
export type Owner = 'shared' | 'A' | 'B' | 'C'
export interface Block {
  owner: Owner
  used: number
  /** How many sequences point at this block. */
  refs: number
}
export interface Sequence {
  name: Exclude<Owner, 'shared'>
  blocks: number[]
  tokens: number
}
export interface Pool {
  step: number
  blocks: (Block | null)[]
  sequences: Sequence[]
}

export const BLOCK_SIZE = 4
export const POOL_BLOCKS = 24
const SYSTEM_TOKENS = 8
const OWN_TOKENS: Record<Sequence['name'], number> = { A: 3, B: 5, C: 2 }

const freeIndex = (p: Pool) => p.blocks.indexOf(null)
export const blocksInUse = (p: Pool) => p.blocks.filter(Boolean).length

/** Adds one token to a sequence, taking a new block if the last is full or shared. False if the pool is full. */
function grow(p: Pool, seq: Sequence): boolean {
  const lastId = seq.blocks[seq.blocks.length - 1]
  const last = lastId === undefined ? null : p.blocks[lastId]
  if (!last || last.used >= BLOCK_SIZE || last.owner === 'shared') {
    const free = freeIndex(p)
    if (free < 0) return false
    p.blocks[free] = { owner: seq.name, used: 1, refs: 1 }
    seq.blocks.push(free)
  } else {
    last.used++
  }
  seq.tokens++
  return true
}

export function initPool(share: boolean): Pool {
  const p: Pool = { step: 0, blocks: Array(POOL_BLOCKS).fill(null), sequences: [] }
  const prefix: number[] = []
  if (share) {
    for (let i = 0; i < SYSTEM_TOKENS / BLOCK_SIZE; i++) {
      p.blocks[i] = { owner: 'shared', used: BLOCK_SIZE, refs: 3 }
      prefix.push(i)
    }
  }
  for (const name of ['A', 'B', 'C'] as const) {
    const seq: Sequence = { name, blocks: [...prefix], tokens: share ? SYSTEM_TOKENS : 0 }
    p.sequences.push(seq)
    const tokens = (share ? 0 : SYSTEM_TOKENS) + OWN_TOKENS[name]
    for (let i = 0; i < tokens; i++) grow(p, seq)
  }
  return p
}

/** One decode step: every sequence adds a token if the pool has room. The old pool is left as it was. */
export function stepPool(p: Pool): Pool {
  const next: Pool = {
    step: p.step + 1,
    blocks: p.blocks.map((b) => (b ? { ...b } : null)),
    sequences: p.sequences.map((s) => ({ ...s, blocks: [...s.blocks] })),
  }
  for (const s of next.sequences) grow(next, s)
  return next
}
