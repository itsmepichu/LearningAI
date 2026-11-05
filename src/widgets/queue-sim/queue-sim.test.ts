import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SIM_SECONDS, simulateQueue } from './simulate.ts'

test('a run is seeded: the same seed repeats, and a new seed differs', () => {
  assert.deepEqual(simulateQueue(7, 4, 0.5, 17), simulateQueue(7, 4, 0.5, 17))
  assert.notEqual(simulateQueue(7, 4, 0.5, 17).meanWait, simulateQueue(7, 4, 0.5, 18).meanWait)
})

test('utilisation is arrival rate × service time ÷ servers', () => {
  assert.equal(simulateQueue(7, 4, 0.5).utilisation, 0.875)
  assert.equal(simulateQueue(8, 4, 0.5).utilisation, 1)
})

test('there is one queue reading per simulated second', () => {
  assert.equal(simulateQueue(7, 4, 0.5).queue.length, SIM_SECONDS)
})

test('the caption’s claim: below about 80% the queue stays short', () => {
  const r = simulateQueue(4, 4, 0.5)
  assert.ok(r.meanWait < 0.2, String(r.meanWait))
})

test('the caption’s claim: near 100% waits explode', () => {
  assert.ok(simulateQueue(7.5, 4, 0.5).meanWait > 5 * simulateQueue(4, 4, 0.5).meanWait)
})

test('the caption’s claim: above 100% the queue grows without limit', () => {
  const { queue } = simulateQueue(12, 4, 0.5)
  assert.ok(queue.at(-1)! > queue[30] * 3, `${queue[30]} then ${queue.at(-1)}`)
})

test('the caption’s claim: Little’s law matches the measured average', () => {
  for (const [rate, servers, service] of [[4, 4, 0.5], [6, 4, 0.5], [2, 2, 0.5]]) {
    const r = simulateQueue(rate, servers, service)
    assert.ok(Math.abs(r.inSystem - r.littles) / r.littles < 0.2, `${r.inSystem} and ${r.littles}`)
  }
})

test('the caption’s claim: the p95 wait is much higher than the mean', () => {
  const r = simulateQueue(7, 4, 0.5)
  assert.ok(r.p95Wait > 2 * r.meanWait)
})

test('more servers shorten the wait', () => {
  assert.ok(simulateQueue(7, 6, 0.5).meanWait < simulateQueue(7, 4, 0.5).meanWait)
})
