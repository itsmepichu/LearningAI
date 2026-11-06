import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BLOCK_SIZE, POOL_BLOCKS, blocksInUse } from '../paged-kv/pool.ts'
import { checkSteps } from '../scene3d/testing.ts'
import { MAX_STEPS, kvSteps, perToken, perTokenLayer, pools } from './kv.ts'

test('KV bytes per token for an 8B-like model with GQA: 4 KiB per layer, 128 KiB in all', () => {
  assert.equal(perTokenLayer, 2 * 8 * 128 * 2)
  assert.equal(perToken, perTokenLayer * 32)
  assert.equal(perToken, 131072)
})

for (const share of [true, false]) {
  test(`share=${share}: the steps follow the pool, cube for cube, in every layer`, () => {
    const ps = pools(share)
    const steps = kvSteps(share)
    checkSteps(steps)
    assert.equal(steps.length, ps.length)
    assert.ok(steps.length <= MAX_STEPS + 1)
    steps.forEach((s, i) => {
      const solid = s.bars!.filter((b) => !b.faded && b.tone !== 'muted').length
      const tokens = ps[i].blocks.reduce((n, b) => n + (b ? b.used : 0), 0)
      assert.equal(solid, tokens * 3, 'one solid cube per stored token in each of the three layers drawn')
      assert.equal(s.bars!.length, POOL_BLOCKS * BLOCK_SIZE * 3)
      assert.ok(s.text.includes(`${blocksInUse(ps[i])} of ${POOL_BLOCKS} blocks`))
    })
    // the third axis is the layer
    assert.equal(new Set(steps[0].bars!.map((b) => b.at[2])).size, 3)
  })
}

test('sharing the prompt stores it once', () => {
  const [a] = pools(true)
  const [b] = pools(false)
  assert.ok(blocksInUse(a) < blocksInUse(b))
  assert.match(kvSteps(true)[0].text, /more than the \d+ stored, because the prompt is shared/)
})
