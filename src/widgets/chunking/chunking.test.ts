import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { chunkDocument, chunkStats, windows } from './chunk.ts'
import { loadChunkSource } from './sources.ts'

const LETTERS = 'a b c d e f g h i j'.split(' ')

test('windows step by size minus overlap and reach the end', () => {
  assert.deepEqual(windows(LETTERS, 4, 1), [
    { start: 0, end: 4, overlap: 0 },
    { start: 3, end: 7, overlap: 1 },
    { start: 6, end: 10, overlap: 1 },
  ])
})

test('a window larger than the text gives one chunk with no overlap', () => {
  assert.deepEqual(windows(LETTERS, 20, 5), [{ start: 0, end: 10, overlap: 0 }])
})

test('overlap is limited to size minus one, so a window always advances', () => {
  const w = windows(LETTERS, 3, 99)
  assert.equal(w.length, 8)
  assert.deepEqual(w.map((x) => x.start), [0, 1, 2, 3, 4, 5, 6, 7])
})

test('an empty section gives no windows', () => {
  assert.deepEqual(windows([], 4, 1), [])
})

const SECTIONS = [
  { heading: 'A', text: 'one two three' },
  { heading: 'B', text: 'four five six' },
]

test('fixed-size chunks run the headings in with the text and can mix sections', () => {
  const chunks = chunkDocument('T', SECTIONS, 'fixed', 4, 0)
  assert.deepEqual(chunks.map((c) => c.words.join(' ')), ['A. one two three', 'B. four five six'])
  const across = chunkDocument('T', SECTIONS, 'fixed', 6, 0)
  assert.equal(across[0].sections, 2)
  assert.equal(chunkStats(SECTIONS, 'fixed', across).mixed, 1)
})

test('paragraph-aware chunks keep to one section and carry a header', () => {
  const chunks = chunkDocument('T', SECTIONS, 'section', 2, 0)
  assert.deepEqual(chunks.map((c) => c.header), ['T › A', 'T › A', 'T › B', 'T › B'])
  assert.ok(chunks.every((c) => c.sections === 1))
})

test('the stats separate overlap from header words', () => {
  const noOverlap = chunkDocument('T', SECTIONS, 'fixed', 4, 0)
  assert.equal(chunkStats(SECTIONS, 'fixed', noOverlap).overlapOverheadPct, 0)
  const section = chunkDocument('T', SECTIONS, 'section', 40, 0)
  const stats = chunkStats(SECTIONS, 'section', section)
  assert.equal(stats.sourceWords, 6)
  assert.equal(stats.storedWords, 6)
  assert.equal(stats.overlapOverheadPct, 0)
  assert.equal(stats.headerWords, 6) // "T › A" twice, three words each
  const overlapped = chunkDocument('T', SECTIONS, 'fixed', 4, 2)
  assert.ok(chunkStats(SECTIONS, 'fixed', overlapped).overlapOverheadPct > 0)
})

for (const id of PROJECT_IDS) {
  test(`${id}: the document is real and shows what the figure teaches`, async () => {
    const src = await loadChunkSource(projectOf(id), readerOf(id))
    assert.ok(src.sections.length >= 3, 'several sections')
    assert.ok(src.sections.every((s) => s.heading && s.text.trim()), 'no empty section')

    const fixed = chunkDocument(src.title, src.sections, 'fixed', 40, 8)
    assert.ok(chunkStats(src.sections, 'fixed', fixed).mixed > 0, 'default fixed-size chunks mix sections')
    const section = chunkDocument(src.title, src.sections, 'section', 40, 8)
    assert.equal(chunkStats(src.sections, 'section', section).mixed, 0)

    // Removing each chunk's overlap gives back the source text, so nothing is lost or reordered.
    const rebuilt = fixed.flatMap((c) => c.words.slice(c.overlap)).join(' ')
    const source = src.sections.map((s) => `${s.heading}. ${s.text}`).join(' ').split(/\s+/).join(' ')
    assert.equal(rebuilt, source)
  })
}

test('store: the injection reviews stay out of the document', async () => {
  const src = await loadChunkSource(projectOf('store'), readerOf('store'))
  const reviews = await readerOf('store').json<{ text: string; is_injection: boolean }[]>('reviews.json')
  const all = src.sections.map((s) => s.text).join(' ')
  assert.ok(reviews.some((r) => r.is_injection), 'the dataset has injection reviews')
  assert.ok(!reviews.filter((r) => r.is_injection).some((r) => all.includes(r.text)))
})
