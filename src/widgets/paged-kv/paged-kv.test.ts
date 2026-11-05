import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BLOCK_SIZE, POOL_BLOCKS, blocksInUse, initPool, stepPool, type Pool } from './pool.ts'

const stepTimes = (p: Pool, n: number) => {
  let next = p
  for (let i = 0; i < n; i++) next = stepPool(next)
  return next
}

test('the caption’s claim: sharing the prefix uses fewer physical blocks', () => {
  assert.ok(blocksInUse(initPool(true)) < blocksInUse(initPool(false)))
  assert.equal(blocksInUse(initPool(true)), 6)
  assert.equal(blocksInUse(initPool(false)), 10)
})

test('with sharing, all three sequences point at the same prefix blocks', () => {
  const p = initPool(true)
  for (const s of p.sequences) assert.deepEqual(s.blocks.slice(0, 2), [0, 1])
  assert.equal(p.blocks[0]!.refs, 3)
  assert.equal(p.blocks[0]!.owner, 'shared')
})

test('token counts are the same with and without sharing', () => {
  assert.deepEqual(initPool(true).sequences.map((s) => s.tokens), initPool(false).sequences.map((s) => s.tokens))
  assert.deepEqual(initPool(true).sequences.map((s) => s.tokens), [11, 13, 10])
})

test('a sequence’s blocks hold exactly its tokens', () => {
  for (const p of [initPool(false), stepTimes(initPool(false), 5), stepTimes(initPool(true), 5)]) {
    for (const s of p.sequences) {
      const held = s.blocks.reduce((n, b) => n + p.blocks[b]!.used, 0)
      assert.equal(held, s.tokens, `sequence ${s.name}`)
    }
  }
})

test('a step adds one token to each sequence', () => {
  const next = stepPool(initPool(true))
  assert.equal(next.step, 1)
  assert.deepEqual(next.sequences.map((s) => s.tokens), [12, 14, 11])
})

test('a step leaves the old pool untouched, so reset and redraw are safe', () => {
  const p = initPool(true)
  const copy = JSON.stringify(p)
  stepPool(p)
  assert.equal(JSON.stringify(p), copy)
})

test('a new block is allocated only when the last one is full', () => {
  const p = initPool(true)
  const a = p.sequences[0]
  assert.equal(p.blocks[a.blocks.at(-1)!]!.used, 3)
  const next = stepPool(p)
  assert.equal(next.sequences[0].blocks.length, a.blocks.length, 'room for one more')
  assert.equal(stepPool(next).sequences[0].blocks.length, a.blocks.length + 1, 'now full, so a new block')
})

test('a shared block is never written to', () => {
  const p = stepTimes(initPool(true), 8)
  assert.equal(p.blocks[0]!.used, BLOCK_SIZE)
  assert.equal(p.blocks[0]!.owner, 'shared')
})

test('when the pool is full, sequences stop growing', () => {
  const p = stepTimes(initPool(false), 60)
  assert.equal(blocksInUse(p), POOL_BLOCKS)
  const settled = stepTimes(p, 10)
  assert.deepEqual(stepPool(settled).sequences.map((s) => s.tokens), settled.sequences.map((s) => s.tokens))
})
