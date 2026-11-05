import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ITL_AXIS_MS, ITL_SLO_MS, MAX_BATCH, bestUnderSlo, perUserSpeed, stepMs, throughput } from './roofline.ts'

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`)

test('the step time matches a hand calculation', () => {
  close(stepMs(1), 4.8 + 0.24 + 1)
  close(stepMs(32), 4.8 + 7.68 + 1)
})

test('throughput is the batch divided by the step time', () => {
  close(throughput(32), (32 / stepMs(32)) * 1000)
})

test('per-user speed times the batch gives the throughput', () => {
  close(perUserSpeed(32) * 32, throughput(32))
})

test('the trade-off: more sequences mean more throughput and worse latency', () => {
  for (let b = 2; b <= MAX_BATCH; b++) {
    assert.ok(throughput(b) > throughput(b - 1), `throughput at ${b}`)
    assert.ok(stepMs(b) > stepMs(b - 1), `latency at ${b}`)
  }
})

test('the best batch is the largest that still meets the target', () => {
  const best = bestUnderSlo()
  assert.equal(best, 184)
  assert.ok(stepMs(best) <= ITL_SLO_MS)
  assert.ok(stepMs(best + 1) > ITL_SLO_MS)
})

test('an unreachable target falls back to one sequence', () => {
  assert.equal(bestUnderSlo(1), 1)
})

test('the latency axis has room for the whole curve', () => {
  assert.ok(stepMs(MAX_BATCH) < ITL_AXIS_MS)
})
