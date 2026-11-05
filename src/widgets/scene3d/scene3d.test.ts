import assert from 'node:assert/strict'
import { test } from 'node:test'
import { causal, concatCols, cols, groupsOf, matmul, randn, rmsNorm, rowRms, seeded, softmaxRows, split, transpose, upright, PITCH } from './tensor.ts'

const close = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} is not ${b}`)

test('matmul multiplies, and refuses mismatched shapes', () => {
  assert.deepEqual(matmul([[1, 2], [3, 4]], [[5], [6]]), [[17], [39]])
  assert.throws(() => matmul([[1, 2]], [[1, 2]]))
})

test('the same seed gives the same matrix', () => {
  assert.deepEqual(randn(seeded(4), 3, 3), randn(seeded(4), 3, 3))
  assert.notDeepEqual(randn(seeded(4), 3, 3), randn(seeded(5), 3, 3))
})

test('causal softmax rows sum to 1 and put no weight on later tokens', () => {
  const a = softmaxRows(causal(randn(seeded(1), 5, 5)))
  a.forEach((row, i) => {
    close(row.reduce((s, v) => s + v, 0), 1)
    row.forEach((v, j) => j > i && assert.equal(v, 0))
  })
  close(a[0][0], 1)
})

test('RMSNorm leaves every row with root-mean-square 1', () => {
  for (const r of rowRms(rmsNorm(randn(seeded(2), 4, 8, 3)))) close(r, 1, 1e-5)
})

test('splitting columns into heads and concatenating them back is lossless', () => {
  const m = randn(seeded(3), 5, 12)
  assert.deepEqual(concatCols(groupsOf(m, 3)), m)
  assert.deepEqual(groupsOf(m, 3)[1], cols(m, 4, 8))
  assert.deepEqual(transpose(transpose(m)), m)
})

test('a split tensor keeps its cells in the same order, so they can glide between layouts', () => {
  const m = randn(seeded(4), 2, 6)
  const a = upright(m, [0, 0, 0])
  const b = split(m, 3, [0, 0, 0], 1)
  assert.equal(a.length, b.length)
  a.forEach((c, i) => assert.equal(c.v, b[i].v))
  // column 5 is head 3's second column: pushed back two heads, one pitch from the left
  assert.deepEqual(b[5].at, [PITCH, 0, -2])
})
