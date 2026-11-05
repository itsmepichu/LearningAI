import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCsv, readCsvHead } from './csv.ts'
import { compact, fmt, pct, usd } from './format.ts'
import { exponential, gauss, mulberry } from './random.ts'

/** A response delivered in the given chunks, which records how many of them were read. */
function streamed(chunks: Uint8Array[]) {
  let pulled = 0
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      if (pulled < chunks.length) c.enqueue(chunks[pulled++])
      else c.close()
    },
  })
  return { res: new Response(body), pulled: () => pulled }
}
const bytes = (s: string) => new TextEncoder().encode(s)

test('parseCsv handles quotes, doubled quotes, commas, newlines and CRLF', () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, ""y""",2\n\n3,\n"line\none",4'), [
    { a: 'x, "y"', b: '2' },
    { a: '3', b: '' },
    { a: 'line\none', b: '4' },
  ])
})

test('parseCsv copes with empty input and short rows', () => {
  assert.deepEqual(parseCsv(''), [])
  assert.deepEqual(parseCsv('a,b'), [])
  assert.deepEqual(parseCsv('a,b\n1'), [{ a: '1', b: '' }])
})

test('readCsvHead returns exactly the rows asked for', async () => {
  const { res } = streamed([bytes('a,b\n1,2\n3,4\n5,6\n')])
  assert.deepEqual(await readCsvHead(res, 2), [
    { a: '1', b: '2' },
    { a: '3', b: '4' },
  ])
})

test('readCsvHead stops reading once it has enough', async () => {
  const { res, pulled } = streamed([bytes('a,b\n1,2\n'), bytes('3,4\n'), bytes('5,6\n'), bytes('7,8\n')])
  assert.deepEqual(await readCsvHead(res, 1), [{ a: '1', b: '2' }])
  assert.ok(pulled() <= 2, `read ${pulled()} of 4 chunks`)
})

test('readCsvHead survives a row or a multi-byte character split across chunks', async () => {
  const all = bytes('a,b\n₹1,2\n3,4\n')
  const cut = 6 // inside the three bytes of ₹
  const { res } = streamed([all.slice(0, cut), all.slice(cut)])
  assert.deepEqual(await readCsvHead(res, 1), [{ a: '₹1', b: '2' }])
})

test('readCsvHead returns what there is when the file is shorter than asked', async () => {
  const { res } = streamed([bytes('a,b\n1,2')])
  assert.deepEqual(await readCsvHead(res, 5), [{ a: '1', b: '2' }])
})

test('money and large numbers read at the right scale', () => {
  assert.equal(usd(0.0044), '$0.0044')
  assert.equal(usd(44), '$44.00')
  assert.equal(usd(1320), '$1,320')
  assert.equal(usd(2500000), '$2.50M')
  assert.equal(compact(398), '398')
  assert.equal(compact(10000), '10.0k')
  assert.equal(compact(501187), '501.2k')
  assert.equal(compact(3000000), '3.0M')
})

test('seeded random numbers repeat, stay in range and have the right means', () => {
  const a = mulberry(5)
  const b = mulberry(5)
  const draws = Array.from({ length: 2000 }, () => a())
  assert.deepEqual(draws, Array.from({ length: 2000 }, () => b()))
  assert.ok(draws.every((v) => v >= 0 && v < 1))
  const r = mulberry(6)
  const normal = Array.from({ length: 4000 }, () => gauss(r))
  assert.ok(Math.abs(normal.reduce((s, v) => s + v, 0) / normal.length) < 0.1)
  const exp = Array.from({ length: 4000 }, () => exponential(r, 2))
  assert.ok(Math.abs(exp.reduce((s, v) => s + v, 0) / exp.length - 2) < 0.2)
})

test('number formatting', () => {
  assert.equal(fmt(1234.5, 1), '1,234.5')
  assert.equal(fmt(2), '2')
  assert.equal(fmt(Infinity), '∞')
  assert.equal(pct(2 / 3), '67%')
  assert.equal(pct(0.125, 1), '12.5%')
})
