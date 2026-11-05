import assert from 'node:assert/strict'
import { test } from 'node:test'
import { binaryCode, cosine, dot, exactSearch, hamming, quantisationReport, recallAgainst, scalarQuantizer } from './vector.ts'
import { mulberry } from '../kit/random.ts'

const IDS = ['a', 'b', 'c']
const VECS = [
  [1, 0, 0, 0],
  [0.8, 0.6, 0, 0],
  [0, 0, 1, 0],
]

test('cosine is scale-free, and zero for a zero vector', () => {
  assert.equal(dot([1, 2], [3, 4]), 11)
  assert.ok(Math.abs(cosine([2, 0], [5, 0]) - 1) < 1e-12)
  assert.ok(Math.abs(cosine([1, 0], [0, 3])) < 1e-12)
  assert.equal(cosine([0, 0], [1, 1]), 0)
})

test('the exact scan ranks by similarity and keeps corpus order on ties', () => {
  const hits = exactSearch(IDS, VECS, [1, 0, 0, 0])
  assert.deepEqual(hits.map((h) => h.id), ['a', 'b', 'c'])
  assert.ok(Math.abs(hits[1].score - 0.8) < 1e-12)
  assert.deepEqual(exactSearch(['x', 'y'], [[1, 0], [1, 0]], [1, 0]).map((h) => h.id), ['x', 'y'])
  assert.equal(exactSearch(IDS, VECS, [1, 0, 0, 0], 2).length, 2)
})

test('scalar quantisation uses one scale for the corpus and stays in range', () => {
  const q = scalarQuantizer([[0.5, -0.25]])
  assert.deepEqual([...q([0.5, -0.25])], [127, -63])
  assert.deepEqual([...q([1, -1])], [127, -127], 'a query beyond the corpus clips')
})

test('binary codes keep the sign, and Hamming counts differing bits', () => {
  const nine = [1, -1, 1, -1, 1, -1, 1, -1, 1]
  const code = binaryCode(nine)
  assert.equal(code.length, 2)
  assert.deepEqual([...code], [0b01010101, 1])
  assert.equal(hamming(code, code), 0)
  assert.equal(hamming(code, binaryCode(nine.map((x) => -x))), 9)
})

test('recall compares the top k only', () => {
  assert.equal(recallAgainst(['a', 'b', 'c'], ['b', 'a', 'z'], 2), 1)
  assert.equal(recallAgainst(['a', 'b'], ['z', 'a'], 1), 0)
  assert.equal(recallAgainst([], ['a'], 3), 0)
})

test('on random unit vectors, smaller codes cost recall and re-scoring buys it back', () => {
  const rnd = mulberry(7)
  const unit = () => {
    const v = Array.from({ length: 64 }, () => rnd() - 0.5)
    const n = Math.sqrt(dot(v, v))
    return v.map((x) => x / n)
  }
  const vectors = Array.from({ length: 200 }, unit)
  const ids = vectors.map((_, i) => `d${i}`)
  const queries = Array.from({ length: 30 }, unit)
  const rows = Object.fromEntries(quantisationReport(ids, vectors, queries, 5).map((r) => [r.id, r]))
  assert.equal(rows.float32.recall, 1)
  assert.equal(rows.float32.bytesPerVector, 256)
  assert.equal(rows.int8.bytesPerVector, 64)
  assert.equal(rows.binary.bytesPerVector, 8)
  assert.ok(rows.int8.recall > 0.9, `int8 recall ${rows.int8.recall}`)
  assert.ok(rows.binary.recall < rows.int8.recall, 'binary loses more than int8')
  assert.ok(rows['binary+rescore'].recall > rows.binary.recall, 're-scoring recovers recall')
})
