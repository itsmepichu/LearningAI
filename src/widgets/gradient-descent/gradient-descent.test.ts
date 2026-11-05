import assert from 'node:assert/strict'
import { test } from 'node:test'
import { descend, loss, run, slope } from './descent.ts'

test('the slope is the derivative of the loss', () => {
  for (const x of [-4, -1, 0, 2, 5]) {
    const h = 1e-6
    assert.ok(Math.abs(slope(x) - (loss(x + h) - loss(x - h)) / (2 * h)) < 1e-6, String(x))
  }
})

test('one step moves against the slope, by the learning rate', () => {
  assert.equal(descend(2, 0.1), 2 - 0.1 * slope(2))
})

test('a run keeps its start and adds one point per step', () => {
  const xs = run(-2.6, 0.2, 25)
  assert.equal(xs.length, 26)
  assert.equal(xs[0], -2.6)
})

test('the caption’s claim: η ≈ 0.2 converges smoothly to a minimum', () => {
  const xs = run(-2.6, 0.2, 200)
  assert.ok(Math.abs(slope(xs.at(-1)!)) < 1e-3)
  xs.slice(1).forEach((x, i) => assert.ok(loss(x) <= loss(xs[i]) + 1e-9, `step ${i}`))
})

test('the caption’s claim: η ≈ 1.0 oscillates around the minimum', () => {
  const xs = run(-2.6, 1, 40)
  const minimum = run(-2.6, 0.2, 500).at(-1)!
  const crossings = xs.slice(1).filter((x, i) => (x - minimum) * (xs[i] - minimum) < 0).length
  assert.ok(crossings >= 3, `${crossings} crossings`)
})

test('the caption’s claim: η ≈ 1.9 keeps bouncing, so the loss sometimes rises', () => {
  const xs = run(-2.6, 1.9, 40)
  const rises = xs.slice(1).filter((x, i) => loss(x) > loss(xs[i])).length
  assert.ok(rises >= 5, `${rises} rises`)
})

test('the caption’s claim: different starts land in different valleys', () => {
  const left = run(-2.6, 0.2, 200).at(-1)!
  const right = run(3, 0.2, 200).at(-1)!
  assert.ok(Math.abs(left - right) > 1, `${left} and ${right}`)
  assert.ok(loss(left) < loss(right), 'one is the global minimum')
})

test('a diverged run stops moving instead of overflowing', () => {
  assert.equal(descend(5000, 1), 5000)
  assert.ok(run(3, 1000, 30).every(Number.isFinite))
})
