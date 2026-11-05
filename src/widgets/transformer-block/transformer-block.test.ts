import assert from 'node:assert/strict'
import { test } from 'node:test'
import { add, rowRms } from '../scene3d/tensor.ts'
import { checkSteps } from '../scene3d/testing.ts'
import { D, F, LLAMA_8B_LIKE, N, blockParams, blockSteps, forward } from './steps.ts'

test('a real pre-norm block: normalised inputs, two residual adds, and the input’s shape out', () => {
  const p = forward(3)
  for (const r of [...rowRms(p.n1), ...rowRms(p.n2)]) assert.ok(Math.abs(r - 1) < 1e-5)
  assert.deepEqual(p.h, add(p.x, p.attn))
  assert.deepEqual(p.out, add(p.h, p.ffn))
  assert.equal(p.u[0].length, F)
  assert.deepEqual([p.out.length, p.out[0].length], [N, D])
})

test('the block is causal: changing later tokens leaves the first token’s output alone', () => {
  const a = forward(3)
  const changed = a.x.map((row, i) => (i === 0 ? row : row.map((v) => v * -2 + 1)))
  const b = forward(3, changed)
  assert.deepEqual(b.out[0], a.out[0])
  assert.notDeepEqual(b.out[N - 1], a.out[N - 1])
})

test('parameter counts match the 5.3 tracer’s formula for an 8B-like block', () => {
  const p = blockParams(LLAMA_8B_LIKE)
  assert.equal(p.attention, 4096 * 4096 * 2 + 4096 * 1024 * 2)
  assert.equal(p.ffn, 3 * 4096 * 14336)
  assert.ok(p.ffn / p.total > 0.75, 'the FFN holds most of a block')
})

test('the floors are consistent and stack upwards, with the FFN floor the widest', () => {
  const steps = blockSteps(3)
  checkSteps(steps)
  const last = steps[steps.length - 1]
  const heights = last.tensors.map((t) => t.cells[0].at[1])
  heights.forEach((h, i) => i > 0 && assert.ok(h > heights[i - 1]))
  const width = (id: string) => last.tensors.find((t) => t.id === id)!.slices[0][0].length
  assert.equal(width('u'), F)
  assert.equal(width('x'), D)
  assert.ok(steps[3].paths?.length, 'the residual stream appears once it is used')
  assert.ok(!steps[2].paths?.length)
})
