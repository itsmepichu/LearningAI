import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { totalBytes } from '../kit/download.ts'
import { TOKENIZERS, TOKENIZER_MODELS } from '../engines/specs.ts'
import { LANGUAGE_NAMES, brokenPieces, loadTokenizerSamples, perLanguage } from './samples.ts'

for (const id of PROJECT_IDS) {
  test(`${id}: has messages in more than one language, at most four each`, async () => {
    const { samples } = await loadTokenizerSamples(projectOf(id), readerOf(id))
    const langs = new Map<string, number>()
    for (const s of samples) langs.set(s.language, (langs.get(s.language) ?? 0) + 1)
    assert.ok(langs.size >= 2, `${id} shows ${langs.size} languages`)
    for (const [lang, n] of langs) {
      assert.ok(n >= 1 && n <= 4, `${lang}: ${n}`)
      assert.ok(LANGUAGE_NAMES[lang], `${lang} has a name`)
    }
    assert.equal(new Set(samples.map((s) => s.text)).size, samples.length, 'no message twice')
  })
}

test('the Travel project has its two languages, English and Tamil', async () => {
  const { samples } = await loadTokenizerSamples(projectOf('travel'), readerOf('travel'))
  assert.deepEqual([...new Set(samples.map((s) => s.language))].sort(), ['en', 'ta'])
})

test('per-language means count tokens per tokenizer and characters by code point', () => {
  const samples = [
    { language: 'en', text: 'ab' },
    { language: 'en', text: 'abcd' },
    { language: 'ta', text: '𝒜𝒜' },
  ]
  const t1 = [{ pieces: ['a', 'b'] }, { pieces: ['ab', 'c', 'd', 'e'] }, { pieces: ['x'] }]
  const t2 = [{ pieces: ['ab'] }, { pieces: ['abcd'] }, { pieces: ['x', 'y', 'z'] }]
  assert.deepEqual(perLanguage(samples, [t1, t2]), [
    { language: 'en', messages: 2, meanChars: 3, meanTokens: [3, 1] },
    { language: 'ta', messages: 1, meanChars: 2, meanTokens: [1, 3] },
  ])
})

test('a piece of a character counts as broken', () => {
  assert.equal(brokenPieces({ pieces: ['ab', '�', 'c�'] }), 2)
})

test('the download is declared before anything runs, and only needs a worker', () => {
  assert.equal(TOKENIZER_MODELS.length, 3)
  assert.ok(totalBytes(TOKENIZERS) > 20e6 && totalBytes(TOKENIZERS) < 25e6)
  assert.deepEqual(TOKENIZERS.needs, ['worker'])
})
