import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { CLASSIC_TEXT, bestPair, bpeStats, initWords, loadBpeText, trainBpe } from './merges.ts'

test('words are split into characters with a start marker, and counted', () => {
  assert.deepEqual(initWords('Low low, new'), [
    { symbols: ['▁', 'l', 'o', 'w'], count: 2 },
    { symbols: ['▁', 'n', 'e', 'w'], count: 1 },
  ])
})

test('vowel signs and the dot that silences a consonant stay in Tamil words', () => {
  assert.deepEqual(initWords('தரம்').flatMap((w) => w.symbols).join(''), '▁தரம்')
  assert.deepEqual(initWords('என்').flatMap((w) => w.symbols).join(''), '▁என்')
})

test('the best pair is weighted by how often its word occurs', () => {
  const words = [
    { symbols: ['a', 'b'], count: 1 },
    { symbols: ['c', 'd'], count: 5 },
  ]
  assert.deepEqual(bestPair(words), { left: 'c', right: 'd', seen: 5 })
})

test('a pair seen only once is never merged', () => {
  assert.equal(bestPair([{ symbols: ['a', 'b'], count: 1 }]), null)
  assert.equal(trainBpe('ab', 3).finished, true)
})

test('a merge applies everywhere, and reduces the token count by its frequency', () => {
  const before = bpeStats(trainBpe('abab abab', 0))
  const after = trainBpe('abab abab', 1)
  assert.equal(after.last!.seen, 4)
  assert.equal(bpeStats(after).tokens, before.tokens - after.last!.seen)
  assert.ok(after.words[0].symbols.includes(after.last!.merged))
})

test('the same text and step count always give the same result', () => {
  assert.deepEqual(trainBpe(CLASSIC_TEXT, 5), trainBpe(CLASSIC_TEXT, 5))
})

test('the caption’s claim: "est" and "er" become tokens quickly in the classic example', () => {
  const { merges } = trainBpe(CLASSIC_TEXT, 12)
  assert.ok(merges.some((m) => m.endsWith('est')), merges.join())
  assert.ok(merges.some((m) => m.endsWith('er')), merges.join())
})

test('training on the classic example shrinks the text', () => {
  assert.ok(bpeStats(trainBpe(CLASSIC_TEXT, 12)).tokens < bpeStats(trainBpe(CLASSIC_TEXT, 0)).tokens)
})

test('empty text is safe', () => {
  assert.deepEqual(trainBpe('', 3).words, [])
  assert.equal(trainBpe('', 3).finished, true)
})

for (const id of PROJECT_IDS) {
  test(`${id}: has training text from its dataset that merges can work on`, async () => {
    const { text } = await loadBpeText(projectOf(id), readerOf(id))
    assert.ok(text.trim().length > 50)
    assert.ok(trainBpe(text, 5).merges.length === 5)
  })
}
