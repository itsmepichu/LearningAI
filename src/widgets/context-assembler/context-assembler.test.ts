import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { assemble, type ContextItem } from './assemble.ts'
import { loadContextItems } from './scenarios.ts'

const item = (name: string, tokens: number, priority: number, compressed: number | null = null): ContextItem => ({ name, tokens, priority, compressed, kind: 'live' })
const ITEMS = [item('must', 100, 0), item('big', 500, 1, 50), item('small', 100, 2)]

test('items are taken in priority order, and a later item that fits still goes in', () => {
  const a = assemble(ITEMS, 400, 100, false)
  assert.deepEqual(a.rows.map((r) => [r.name, r.included]), [['must', true], ['big', false], ['small', true]])
  assert.equal(a.used, 200)
  assert.equal(a.free, 100)
  assert.equal(a.reserved, 100)
})

test('input order does not matter', () => {
  const a = assemble([...ITEMS].reverse(), 400, 100, false)
  assert.deepEqual(a.rows.map((r) => r.name), ['must', 'big', 'small'])
})

test('compression shrinks only what can be compressed, and keeps the original size', () => {
  const big = assemble(ITEMS, 400, 100, true).rows.find((r) => r.name === 'big')!
  assert.equal(big.size, 50)
  assert.equal(big.tokens, 500)
  assert.equal(big.isCompressed, true)
  assert.equal(assemble(ITEMS, 400, 100, true).rows[0].isCompressed, false)
})

test('used, free and reserved always add up to the budget', () => {
  for (const [budget, reserve] of [[8000, 1000], [2000, 200], [3000, 3000]]) {
    const a = assemble(ITEMS, budget, reserve, false)
    assert.equal(a.used + a.free + a.reserved, budget)
  }
})

test('a reserve as large as the window leaves nothing, and says must-haves were dropped', () => {
  const a = assemble(ITEMS, 2000, 4000, false)
  assert.equal(a.droppedMust, 1)
  assert.equal(a.used, 0)
  assert.equal(a.free, 0)
  assert.equal(a.reserved, 2000)
})

for (const id of PROJECT_IDS) {
  test(`${id}: items use real titles, and the page's example holds`, async () => {
    const { items } = await loadContextItems(projectOf(id), readerOf(id))
    assert.equal(items.length, 13)
    assert.equal(new Set(items.map((i) => i.name)).size, items.length, 'item names are unique, because the table keys on them')
    assert.ok(items.some((i) => i.name.includes(projectOf(id).assistant)))
    // A roomy budget fits everything once compressed; a tight one drops the lowest priorities first.
    const roomy = assemble(items, 16000, 1000, true)
    assert.ok(roomy.rows.every((r) => r.included))
    const tight = assemble(items, 3000, 200, false)
    assert.equal(tight.droppedMust, 0)
    assert.equal(tight.rows.find((r) => r.priority === 7)!.included, false)
  })
}
