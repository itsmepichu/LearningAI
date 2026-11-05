import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { asInputTokens, estimateTokens, requestCost } from './estimate.ts'
import { firstPerLanguage, loadSamples } from './samples.ts'

const SHAPE = { inputTokens: 3000, outputTokens: 350, requestsPerDay: 10000, inputPrice: 1, outputPrice: 4, decodeSpeed: 60 }
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`)

test('the estimate follows the heuristic for each kind of character', () => {
  assert.equal(estimateTokens('abcdabcd'), 2)
  assert.equal(estimateTokens('12345678'), 4)
  assert.equal(estimateTokens('मेरा'), 3)
})

test('the estimate is never zero', () => {
  assert.equal(estimateTokens(''), 1)
})

test('non-Latin scripts cost more per character, which is what the figure teaches', () => {
  assert.ok(estimateTokens('मेरा ऑर्डर अभी तक नहीं आया') / 26 > estimateTokens('Where is my order today now') / 27)
})

test('cost and latency match a hand calculation', () => {
  const c = requestCost(SHAPE)
  close(c.perRequest, 0.003 + 0.0014)
  close(c.perDay, 44)
  close(c.perMonth, 1320)
  close(c.outputShare, 0.0014 / 0.0044)
  close(c.ttft, 0.08 + 0.3)
  close(c.total, 0.38 + 349 / 60)
})

test('halving the input halves that part of the cost and shortens the first token', () => {
  const half = requestCost({ ...SHAPE, inputTokens: 1500 })
  close(half.perRequest, 0.0015 + 0.0014)
  assert.ok(half.ttft < requestCost(SHAPE).ttft)
})

test('a counted text is rounded into the input slider’s range', () => {
  assert.equal(asInputTokens(16), 100)
  assert.equal(asInputTokens(1234), 1200)
  assert.equal(asInputTokens(99999), 20000)
})

test('firstPerLanguage keeps the first message of each language and names it', () => {
  const rows = [
    { language: 'en', text: 'first' },
    { language: 'en', text: 'second' },
    { language: 'ta', text: 'tamil' },
    { language: 'xx', text: 'other' },
    { language: 'hi', text: '' },
  ]
  assert.deepEqual(firstPerLanguage(rows), [
    { language: 'English', text: 'first' },
    { language: 'Tamil', text: 'tamil' },
    { language: 'xx', text: 'other' },
  ])
})

const LANGUAGES = { harbor: ['English', 'German', 'Tamil'], store: ['English', 'Hindi', 'Tamil', 'Hinglish'], bank: ['English', 'Hindi', 'Tamil', 'Hinglish'], travel: ['English', 'Hindi', 'Tamil', 'Hinglish'] }

for (const id of PROJECT_IDS) {
  test(`${id}: samples cover the languages its dataset has, as its note asks`, async () => {
    const { samples } = await loadSamples(projectOf(id), readerOf(id))
    assert.deepEqual(samples.map((s) => s.language).sort(), [...LANGUAGES[id]].sort())
    assert.ok(samples.every((s) => s.text.trim()))
  })
}
