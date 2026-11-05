import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectOf, readerOf } from '../kit/testing.ts'
import { SUGGESTIONS, loadCorpus } from './corpus.ts'
import { B, K1, buildIndex, idf, postings, rankIds, search, tokenize } from './engine.ts'

test('tokenize lower-cases, drops stop words and punctuation, and strips a plural s', () => {
  assert.deepEqual(tokenize("Can't Log-in to Payments!"), ['t', 'log-in', 'payment'])
  assert.deepEqual(tokenize('the and of'), [])
  assert.deepEqual(tokenize(''), [])
})

test('tokenize keeps whole words in other scripts, including their vowel signs', () => {
  assert.deepEqual(tokenize('मेरा ऑर्डर'), ['मेरा', 'ऑर्डर'])
  assert.deepEqual(tokenize('என் ஆர்டர்!'), ['என்', 'ஆர்டர்'])
})

test('a Hindi query finds the Hindi document, not just some of its letters', () => {
  const ix = buildIndex([
    { id: 'hi', text: 'मेरा ऑर्डर नहीं आया' },
    { id: 'en', text: 'my order did not arrive' },
  ])
  const [top, rest] = search(ix, 'ऑर्डर')
  assert.equal(top.index, 0)
  assert.equal(rest.score, 0)
})

test('the score matches the BM25 formula, worked by hand', () => {
  const ix = buildIndex([
    { id: 'a', text: 'apple apple pear' },
    { id: 'b', text: 'pear plum' },
  ])
  assert.equal(ix.avgdl, 2.5)
  const expectedIdf = Math.log(1 + (2 - 1 + 0.5) / (1 + 0.5))
  assert.ok(Math.abs(idf(ix, 'apple') - expectedIdf) < 1e-12)
  const [top, rest] = search(ix, 'apple')
  const expected = (expectedIdf * 2 * (K1 + 1)) / (2 + K1 * (1 - B + (B * 3) / 2.5))
  assert.equal(top.index, 0)
  assert.ok(Math.abs(top.score - expected) < 1e-12)
  assert.deepEqual(top.matched, ['apple'])
  assert.equal(rest.score, 0)
})

test('a repeated query term counts once', () => {
  const ix = buildIndex([{ id: 'a', text: 'apple pear' }])
  assert.equal(search(ix, 'apple apple')[0].score, search(ix, 'apple')[0].score)
})

test('ties keep corpus order, and an empty corpus or query is safe', () => {
  const ix = buildIndex([
    { id: 'a', text: 'pear' },
    { id: 'b', text: 'pear' },
  ])
  assert.deepEqual(search(ix, 'pear').map((h) => h.index), [0, 1])
  assert.deepEqual(search(ix, '').map((h) => h.score), [0, 0])
  assert.deepEqual(search(buildIndex([]), 'pear'), [])
})

test('postings report document frequency and term counts, and terms missing from the index', () => {
  const ix = buildIndex([
    { id: 'a', text: 'apple apple pear' },
    { id: 'b', text: 'pear plum' },
  ])
  const [pear, kiwi] = postings(ix, 'pear kiwi')
  assert.equal(pear.df, 2)
  assert.deepEqual(pear.docs, [
    { index: 0, tf: 1 },
    { index: 1, tf: 1 },
  ])
  assert.equal(kiwi.df, 0)
  assert.deepEqual(kiwi.docs, [])
})

test('rankIds leaves out documents that match nothing', () => {
  const docs = [
    { id: 'a', text: 'apple' },
    { id: 'b', text: 'pear' },
  ]
  assert.deepEqual(rankIds(docs, 'pear', 8), ['b'])
  assert.deepEqual(rankIds(docs, 'kiwi', 8), [])
})

test('the corpora: Harbor leaves out old revisions, and ids are unique', async () => {
  const harbor = await loadCorpus(projectOf('harbor'), readerOf('harbor'))
  assert.equal(harbor.docs.length, 16)
  for (const id of ['harbor', 'store', 'bank', 'travel'] as const) {
    const { docs } = await loadCorpus(projectOf(id), readerOf(id))
    assert.ok(docs.length >= 8, id)
    assert.equal(new Set(docs.map((d) => d.id)).size, docs.length, id)
  }
})

/** What each suggested query's hint tells the reader, checked against the real dataset. */
const CLAIMS = {
  harbor: {
    'annual leave carry over': { top: 'HP-001' },
    'HTTP 429': { top: 'HP-013', matches: 1 },
    'cannot log in': { top: 'HP-014', matches: 1 },
  },
  store: {
    'BZ-FOO-1130': { top: 'BZ-FOO-1130', matches: 1 },
    'UK 8 sneakers': { topTitle: /sneakers.*UK 8|UK 8.*sneakers/i },
    'comfortable shoes for walking UK 8': { unmatched: ['comfortable', 'walking'] },
  },
  bank: {
    '3.5% markup': { top: 'NB-004' },
    'UPI debit reversal': { top: 'NB-005', second: 'NB-002', unmatched: ['debit', 'reversal'] },
    'paise kat gaye payment fail': { top: 'NB-002', unmatched: ['paise', 'kat', 'gaye'] },
  },
  travel: {
    'saver change fee': { top: 'SR-001' },
    '48 hours': { top: 'SR-004', matches: 3 },
    'flight cancelled because of heavy rain': { top: 'SR-007', unmatched: ['heavy', 'rain'] },
  },
} as const

for (const id of ['harbor', 'store', 'bank', 'travel'] as const) {
  test(`${id}: the suggested queries do what their hints say`, async () => {
    const corpus = await loadCorpus(projectOf(id), readerOf(id))
    const ix = buildIndex(corpus.docs)
    assert.deepEqual(SUGGESTIONS[id].map((s) => s.q).sort(), Object.keys(CLAIMS[id]).sort())
    for (const { q } of SUGGESTIONS[id]) {
      const claim: { top?: string; second?: string; matches?: number; topTitle?: RegExp; unmatched?: readonly string[] } = CLAIMS[id][q as keyof (typeof CLAIMS)[typeof id]]
      const hits = search(ix, q).filter((h) => h.score > 0)
      const ids = hits.map((h) => corpus.docs[h.index].id)
      if (claim.top) assert.equal(ids[0], claim.top, q)
      if (claim.second) assert.equal(ids[1], claim.second, q)
      if (claim.matches) assert.equal(hits.length, claim.matches, q)
      if (claim.topTitle) assert.match(corpus.docs[hits[0].index].title, claim.topTitle, q)
      for (const term of claim.unmatched ?? []) assert.equal(ix.df.get(term) ?? 0, 0, `${q}: "${term}" should not be in the index`)
    }
  })
}
