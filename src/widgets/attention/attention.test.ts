import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HEADS, TOKENS, attentionWeights, describeRow } from './weights.ts'

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`)

test('each row is a probability distribution', () => {
  for (let head = 0; head < HEADS.length; head++) {
    for (const causal of [true, false]) {
      for (const row of attentionWeights(head, causal, 1.2)) close(row.reduce((a, b) => a + b, 0), 1)
    }
  }
})

test('the causal mask gives later tokens exactly zero weight', () => {
  const w = attentionWeights(0, true, 1.2)
  w.forEach((row, i) => row.forEach((v, j) => j > i && assert.equal(v, 0)))
})

test('without the mask, a token can attend to later tokens', () => {
  assert.ok(attentionWeights(1, false, 1.2)[0][1] > 0)
})

test('the first token under a causal mask can only attend to itself', () => {
  close(attentionWeights(0, true, 1.2)[0][0], 1)
})

test('the caption’s claim: a larger score scale makes attention sharper', () => {
  const top = (scale: number) => Math.max(...attentionWeights(1, true, scale)[4])
  assert.ok(top(4) > top(1.2))
  assert.ok(top(1.2) > top(0.2))
})

test('head 2 sends “restarted” to “server”, skipping “crashed”', () => {
  const row = attentionWeights(1, true, 1.2)[TOKENS.indexOf('restarted')]
  assert.equal(TOKENS[row.indexOf(Math.max(...row))], 'server')
})

test('head 1 attends to the previous word, and head 3 to itself', () => {
  const previous = attentionWeights(0, true, 3)[3]
  assert.equal(previous.indexOf(Math.max(...previous)), 2)
  const self = attentionWeights(2, true, 3)[3]
  assert.equal(self.indexOf(Math.max(...self)), 3)
})

test('the words under the table list the largest first and drop tiny weights', () => {
  const described = describeRow([0.001, 0.1, 0.899, 0, 0])
  assert.deepEqual(described.map((d) => d.token), ['that', 'server'])
})
