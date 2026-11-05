import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { MAX_ROWS, loadLabelled } from './examples.ts'
import { accuracyBy, evaluate, majorityBaseline, predict, predictProba, softmax, stratifiedSplit, trainSoftmax } from './softmax.ts'

for (const id of PROJECT_IDS) {
  test(`${id}: has labelled text to learn from`, async () => {
    const set = await loadLabelled(projectOf(id), readerOf(id))
    assert.ok(set.rows.length >= 200 && set.rows.length <= MAX_ROWS, `${set.rows.length} rows`)
    const labels = new Set(set.rows.map((r) => r.label))
    assert.ok(labels.size >= 3, `${labels.size} classes`)
    for (const r of set.rows) assert.ok(r.text && r.label && r.language, `${r.id} is complete`)
    assert.ok(set.tryText.length > 10)
  })
}

test('the store set leaves out the planted injection reviews', async () => {
  const { rows } = await loadLabelled(projectOf('store'), readerOf('store'))
  assert.ok(rows.every((r) => !/ignore (all|previous)/i.test(r.text)))
})

test('the split is reproducible, complete and keeps every class on both sides', () => {
  const labels = [...Array(30).fill('a'), ...Array(6).fill('b'), 'c', 'c']
  const a = stratifiedSplit(labels, 0.7, 7)
  assert.deepEqual(a, stratifiedSplit(labels, 0.7, 7))
  assert.notDeepEqual(a, stratifiedSplit(labels, 0.7, 8))
  assert.deepEqual([...a.train, ...a.test].sort((x, y) => x - y), labels.map((_, i) => i))
  for (const c of ['a', 'b', 'c']) {
    assert.ok(a.train.some((i) => labels[i] === c), `${c} in train`)
    assert.ok(a.test.some((i) => labels[i] === c), `${c} in test`)
  }
  assert.equal(a.train.filter((i) => labels[i] === 'a').length, 21)
})

test('softmax sums to one and survives large scores', () => {
  const p = softmax([1000, 1000, -1000])
  assert.ok(Math.abs(p[0] - 0.5) < 1e-9 && Math.abs(p[0] + p[1] + p[2] - 1) < 1e-9)
})

test('it learns separable classes from a fixture and is deterministic', () => {
  const x = [[1, 0], [0.9, 0.1], [0.8, 0], [0, 1], [0.1, 0.9], [0, 0.8], [-1, 0], [-0.9, 0.1], [-0.8, -0.1]]
  const y = ['a', 'a', 'a', 'b', 'b', 'b', 'c', 'c', 'c']
  const m = trainSoftmax(x, y)
  assert.deepEqual(x.map((v) => predict(m, v)), y)
  assert.deepEqual(m, trainSoftmax(x, y))
  const p = predictProba(m, [1, 0])
  assert.ok(p[0] > 0.5 && Math.abs(p.reduce((s, v) => s + v, 0) - 1) < 1e-9)
})

test('metrics match a hand count', () => {
  const e = evaluate(['a', 'a', 'a', 'b'], ['a', 'a', 'b', 'b'])
  assert.equal(e.accuracy, 0.75)
  assert.deepEqual(e.confusion, [[2, 1], [0, 1]])
  const [a, b] = e.classes
  assert.deepEqual([a.precision, a.recall, a.support], [1, 2 / 3, 3])
  assert.deepEqual([b.precision, b.recall, b.support], [0.5, 1, 1])
  assert.ok(Math.abs(a.f1 - 0.8) < 1e-12)
  assert.ok(Math.abs(e.macroF1 - (0.8 + 2 / 3) / 2) < 1e-12)
})

test('a class only ever wrongly predicted does not raise macro F1', () => {
  const e = evaluate(['a', 'a'], ['a', 'z'])
  assert.ok(Math.abs(e.macroF1 - 2 / 3) < 1e-12)
})

test('the baseline predicts the most common training class', () => {
  assert.deepEqual(majorityBaseline(['x', 'y', 'y'], ['y', 'x', 'y', 'y']), { label: 'y', accuracy: 0.75 })
})

test('accuracy per group has the largest group first', () => {
  assert.deepEqual(accuracyBy(['en', 'ta', 'en'], ['a', 'b', 'a'], ['a', 'a', 'b']), [
    { group: 'en', n: 2, accuracy: 0.5 },
    { group: 'ta', n: 1, accuracy: 0 },
  ])
})
