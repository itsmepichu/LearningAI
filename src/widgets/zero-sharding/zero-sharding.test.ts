import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkSteps } from '../scene3d/testing.ts'
import { commVolume, perGpu, total, zeroSteps } from './memory.ts'

test('the ZeRO paper’s memory per GPU: 16Ψ, 4Ψ + 12Ψ/N, 2Ψ + 14Ψ/N and 16Ψ/N bytes', () => {
  const P = 7e9
  const N = 8
  assert.equal(total(perGpu(0, P, N)), 16 * P)
  assert.equal(total(perGpu(1, P, N)), 4 * P + (12 * P) / N)
  assert.equal(total(perGpu(2, P, N)), 2 * P + (14 * P) / N)
  assert.equal(total(perGpu(3, P, N)), (16 * P) / N)
  assert.deepEqual([0, 1, 2, 3].map(commVolume), [2, 2, 2, 3])
})

test('the same formula as the 2D figure on 6.6 (stage values from its code)', () => {
  const N = 8e9
  const G = 8
  const legacy = [16 * N, 4 * N + (12 * N) / G, 2 * N + (14 * N) / G, (16 * N) / G]
  legacy.forEach((v, i) => assert.equal(total(perGpu(i, N, G)), v))
})

test('the steps: one stage per step, bars stack to each GPU’s total, and the text says whether it fits', () => {
  const steps = zeroSteps({ params: 7e9, gpus: 8, capacity: 80e9 })
  checkSteps(steps)
  assert.equal(steps.length, 4)
  assert.match(steps[0].text, /112 GB per GPU/)
  assert.match(steps[0].text, /does not fit/)
  assert.match(steps[3].text, /holds 14 GB/)
  assert.match(steps[3].text, /It fits/)
  // the current stage's bars: 8 GPUs × 3 parts, equal stacks
  const current = steps[3].bars!.filter((b) => !b.faded)
  assert.equal(current.length, 24)
  const tops = new Set(current.filter((b) => b.id.endsWith('optimizer')).map((b) => (b.at[1] + b.size[1]).toFixed(6)))
  assert.equal(tops.size, 1, 'every GPU holds the same amount')
  // the third axis is the stage
  assert.equal(new Set(steps[3].bars!.map((b) => b.at[2])).size, 4)
})
