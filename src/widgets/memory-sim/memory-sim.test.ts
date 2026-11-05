import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { TURNS, loadScript } from './scripts.ts'
import { contextTokens, factRow, inWindow, knownFacts, type Fact } from './strategies.ts'

const FACT: Fact = { name: 'f', turn: 10, summary: 'gist', store: 'full' }

test('the window is the k turns before the question', () => {
  assert.equal(inWindow(19, 20, 4), true)
  assert.equal(inWindow(16, 20, 4), true)
  assert.equal(inWindow(15, 20, 4), false)
  assert.equal(inWindow(20, 20, 4), false, 'the question itself is not a kept turn')
})

test('out of the window, each strategy keeps what it can', () => {
  assert.deepEqual(factRow(FACT, 20, 4), { fullHistory: 'full', window: 'lost', summary: 'gist', store: 'full' })
})

test('in the window, every strategy has the exact fact', () => {
  assert.deepEqual(factRow({ ...FACT, store: 'lost' }, 12, 4), { fullHistory: 'full', window: 'full', summary: 'full', store: 'full' })
})

test('only facts stated before the question count', () => {
  assert.deepEqual(knownFacts([FACT], 10), [])
  assert.deepEqual(knownFacts([FACT], 11), [FACT])
})

test('the costs at 200 tokens per turn', () => {
  assert.deepEqual(contextTokens(20, 4), { fullHistory: 4000, window: 1000, summary: 1300, store: 1120 })
})

test('a window larger than the history costs no more than the history', () => {
  const c = contextTokens(4, 10)
  assert.equal(c.window, c.fullHistory)
})

for (const id of PROJECT_IDS) {
  test(`${id}: a 24-turn script that states each fact on its turn`, async () => {
    const { turns, facts } = await loadScript(projectOf(id), readerOf(id))
    assert.equal(turns.length, TURNS)
    assert.ok(turns.every((t) => !t.includes('{')), 'every placeholder is filled')
    assert.deepEqual(facts.map((f) => f.turn), [2, 3, 7, 12, 16])
    assert.ok(facts.every((f) => !f.name.includes('{')))
    assert.ok(turns.join(' ').includes(projectOf(id).company))
    // The reference from the dataset is stated at turn 2, and named by the first fact.
    const ref = facts[0].name.split(' ').at(-1)!
    assert.ok(turns[1].includes(ref), `turn 2 should state ${ref}`)
  })

  test(`${id}: the facts show what the caption claims`, async () => {
    const { facts } = await loadScript(projectOf(id), readerOf(id))
    assert.ok(facts.some((f) => f.summary === 'gist' && f.store === 'full'), 'a summary drops an exact value the fact store keeps')
    assert.ok(facts.some((f) => f.store === 'lost'), 'the fact store misses a field it has no slot for')
    // At the last question with the smallest window, neither strategy alone keeps everything exactly.
    const rows = facts.map((f) => factRow(f, TURNS, 2))
    assert.ok(rows.some((r) => r.summary !== 'full'))
    assert.ok(rows.some((r) => r.store !== 'full'))
  })
}
