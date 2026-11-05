import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CALIBRATED, OVERCONFIDENT, ece } from './bins.ts'

test('there are ten bins, centred across the range', () => {
  assert.equal(OVERCONFIDENT.length, 10)
  assert.equal(OVERCONFIDENT[0].predicted, 0.05)
  assert.equal(OVERCONFIDENT[9].predicted, 0.95)
})

test('the caption’s claim: an over-confident model’s bars sit below the diagonal', () => {
  assert.ok(OVERCONFIDENT.every((b) => b.observed < b.predicted))
})

test('ECE is the mean gap, and matches the figures the diagram states', () => {
  const bins = [{ predicted: 0.5, observed: 0.3, off: true }, { predicted: 0.2, observed: 0.2, off: false }]
  assert.ok(Math.abs(ece(bins) - 0.1) < 1e-12)
  assert.equal(ece(OVERCONFIDENT).toFixed(2), '0.13')
  assert.equal(ece(CALIBRATED).toFixed(2), '0.01')
})

test('calibration brings every bin back near the diagonal', () => {
  assert.ok(CALIBRATED.every((b) => !b.off))
  assert.ok(OVERCONFIDENT.filter((b) => b.off).length >= 7)
})

test('observed frequencies stay valid probabilities', () => {
  for (const b of [...OVERCONFIDENT, ...CALIBRATED]) assert.ok(b.observed >= 0 && b.observed <= 1)
})
