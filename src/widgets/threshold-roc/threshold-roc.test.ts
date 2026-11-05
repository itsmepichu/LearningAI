import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CASES, POSITIVES, confusionAt, curves, makeScores, metricsAt } from './curves.ts'

const scores = makeScores()

test('the scores are seeded, with the stated numbers of cases', () => {
  assert.deepEqual(makeScores(), scores)
  assert.equal(scores.length, CASES)
  assert.equal(scores.filter((s) => s.positive).length, POSITIVES)
  assert.ok(scores.every((s) => s.score >= 0 && s.score <= 1))
})

test('the confusion counts always add up', () => {
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const c = confusionAt(scores, t)
    assert.equal(c.tp + c.fn, POSITIVES, `positives at ${t}`)
    assert.equal(c.fp + c.tn, CASES - POSITIVES, `negatives at ${t}`)
  }
})

test('the metrics match their definitions', () => {
  const m = metricsAt(scores, 0.5)
  assert.equal(m.precision, m.tp / (m.tp + m.fp))
  assert.equal(m.recall, m.tp / POSITIVES)
  assert.equal(m.f1, (2 * m.precision * m.recall) / (m.precision + m.recall))
  assert.equal(m.accuracy, (m.tp + m.tn) / CASES)
  assert.equal(m.falsePositiveRate, m.fp / (CASES - POSITIVES))
})

test('a threshold of 0 flags everything', () => {
  const m = metricsAt(scores, 0)
  assert.equal(m.recall, 1)
  assert.equal(m.falsePositiveRate, 1)
})

test('flagging nothing has no false positives', () => {
  const m = metricsAt(scores, 1.01)
  assert.equal(m.recall, 0)
  assert.equal(m.falsePositiveRate, 0)
  assert.equal(m.f1, 0)
})

test('the caption’s claim: lowering the threshold raises recall and lowers precision', () => {
  const high = metricsAt(scores, 0.7)
  const low = metricsAt(scores, 0.4)
  assert.ok(low.recall > high.recall)
  assert.ok(low.precision < high.precision)
})

test('the ROC curve runs from the origin to the far corner and never falls', () => {
  const { roc } = curves(scores)
  assert.deepEqual(roc[0], [0, 0])
  assert.deepEqual(roc.at(-1), [1, 1])
  roc.slice(1).forEach((p, i) => {
    assert.ok(p[0] >= roc[i][0] && p[1] >= roc[i][1])
  })
})

test('the AUC is a sensible figure for overlapping scores', () => {
  const { auc } = curves(scores)
  assert.ok(auc > 0.8 && auc < 1, String(auc))
})
