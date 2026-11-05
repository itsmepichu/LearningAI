import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { loadStreamScenario, piecesAt } from './scenarios.ts'

test('nothing appears before the first token', () => {
  assert.equal(piecesAt(0, 0.7, 3.5, 20), 0)
  assert.equal(piecesAt(0.69, 0.7, 3.5, 20), 0)
})

test('the first piece appears at the first token', () => {
  assert.equal(piecesAt(0.7, 0.7, 3.5, 20), 1)
})

test('pieces arrive at a steady rate and never pass the total', () => {
  assert.equal(piecesAt(0.7 + 1.75, 0.7, 3.5, 20), 11)
  assert.equal(piecesAt(4.2, 0.7, 3.5, 20), 20)
  assert.equal(piecesAt(100, 0.7, 3.5, 20), 20)
  assert.equal(piecesAt(Infinity, 0.7, 3.5, 20), 20)
})

for (const id of PROJECT_IDS) {
  test(`${id}: has a question and an answer`, async () => {
    const s = await loadStreamScenario(projectOf(id), readerOf(id))
    assert.ok(s.question.trim())
    assert.ok(s.answer.split(/\s+/).length >= 10, 'long enough to watch it stream')
  })
}

test('only the store answer is written for the figure, and it says so', async () => {
  for (const id of PROJECT_IDS) {
    const s = await loadStreamScenario(projectOf(id), readerOf(id))
    assert.equal(s.illustrativeAnswer, id === 'store', id)
    if (id !== 'store') {
      const rows = await readerOf(id).json<{ text: string }[]>(s.file)
      assert.ok(rows.some((r) => r.text === s.answer), `${id}: the answer should quote ${s.file}`)
    }
  }
})
