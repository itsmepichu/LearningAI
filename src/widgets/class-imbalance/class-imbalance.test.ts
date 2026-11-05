import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectOf, readerOf } from '../kit/testing.ts'
import { POINTS, boundaryY, confusion, makePoints, probability, train } from './model.ts'
import { loadRareClass } from './rates.ts'

const positives = (rate: number, seed = 3) => makePoints(seed, rate).filter((p) => p.positive).length

test('points are seeded: the same seed gives the same data', () => {
  assert.deepEqual(makePoints(3, 0.05), makePoints(3, 0.05))
  assert.notDeepEqual(makePoints(3, 0.05), makePoints(4, 0.05))
  assert.equal(makePoints(3, 0.05).length, POINTS)
})

test('the positive rate is roughly what was asked for', () => {
  assert.ok(Math.abs(positives(0.15) / POINTS - 0.15) < 0.04)
  assert.ok(Math.abs(positives(0.02) / POINTS - 0.02) < 0.02)
})

test('the confusion counts add up and agree with the metrics', () => {
  const pts = makePoints(3, 0.05)
  const c = confusion(pts, train(pts, false), 0.5)
  assert.equal(c.tp + c.fp + c.fn + c.tn, POINTS)
  assert.equal(c.accuracy, (c.tp + c.tn) / POINTS)
  assert.equal(c.recall, c.tp / (c.tp + c.fn))
})

test('the caption’s claim: without weights, accuracy is high and recall is low', () => {
  const pts = makePoints(3, 0.02)
  const c = confusion(pts, train(pts, false), 0.5)
  assert.ok(c.accuracy > 0.95, `accuracy ${c.accuracy}`)
  assert.ok(c.recall < 0.5, `recall ${c.recall}`)
})

test('the caption’s claim: class weights raise recall and lower precision', () => {
  const pts = makePoints(3, 0.05)
  const plain = confusion(pts, train(pts, false), 0.5)
  const weighted = confusion(pts, train(pts, true), 0.5)
  assert.ok(weighted.recall > plain.recall)
  assert.ok(weighted.precision! < plain.precision!)
})

test('the caption’s claim: a lower threshold raises recall', () => {
  const pts = makePoints(3, 0.05)
  const w = train(pts, false)
  assert.ok(confusion(pts, w, 0.1).recall > confusion(pts, w, 0.5).recall)
})

test('flagging nothing leaves precision undefined rather than a made-up number', () => {
  const pts = makePoints(3, 0.02)
  assert.equal(confusion(pts, [-50, 0, 0], 0.5).precision, null)
})

test('a point on the boundary has exactly the threshold’s probability', () => {
  const pts = makePoints(3, 0.15)
  const w = train(pts, true)
  const x = 0.5
  const y = boundaryY(w, 0.3, x)!
  assert.ok(Math.abs(probability(w, { x, y }) - 0.3) < 1e-9)
})

test('a flat model has no boundary to draw', () => {
  assert.equal(boundaryY([0, 1, 0], 0.5, 0.5), null)
})

test('the rates counted from the datasets match what projects.json and the notes say', async () => {
  const rate = async (id: 'harbor' | 'store' | 'bank' | 'travel') => (await loadRareClass(projectOf(id), readerOf(id))).rate
  assert.ok(Math.abs((await rate('harbor')) - 0.02) < 0.01, 'security tickets about 2%')
  assert.ok(Math.abs((await rate('store')) - 0.14) < 0.03, 'returns about 14%')
  assert.ok(Math.abs((await rate('bank')) - 0.014) < 0.005, 'fraud about 1.4%')
  assert.ok(Math.abs((await rate('travel')) - 0.14) < 0.03, 'cancellations about 14%')
})
