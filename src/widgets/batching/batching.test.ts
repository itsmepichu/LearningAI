import assert from 'node:assert/strict'
import { test } from 'node:test'
import { REQUESTS, SLOTS, requestLengths, schedule, utilisation } from './schedule.ts'

const lengths = requestLengths()

/** How many decode steps each request gets in a grid. */
const workDone = (grid: number[][]) => {
  const done = new Map<number, number>()
  for (const row of grid) for (const v of row) if (v >= 0) done.set(v, (done.get(v) ?? 0) + 1)
  return done
}

test('the requests are seeded, with lengths in range', () => {
  assert.deepEqual(requestLengths(), lengths)
  assert.equal(lengths.length, REQUESTS)
  assert.ok(lengths.every((l) => l >= 3 && l <= 16))
})

for (const mode of ['static', 'continuous'] as const) {
  test(`${mode}: every request gets exactly the steps it needs`, () => {
    const done = workDone(schedule(mode, lengths))
    lengths.forEach((l, i) => assert.equal(done.get(i), l, `request ${i}`))
  })

  test(`${mode}: every step has one cell per slot, and no request is in two slots at once`, () => {
    for (const row of schedule(mode, lengths)) {
      assert.equal(row.length, SLOTS)
      const busy = row.filter((v) => v >= 0)
      assert.equal(new Set(busy).size, busy.length)
    }
  })
}

test('the caption’s claim: continuous batching finishes sooner, with higher utilisation', () => {
  const s = schedule('static', lengths)
  const c = schedule('continuous', lengths)
  assert.ok(c.length < s.length, `${c.length} and ${s.length}`)
  assert.ok(utilisation(c) > utilisation(s))
})

test('a static batch holds its slots until its longest request ends', () => {
  const grid = schedule('static', [2, 5, 1, 1])
  assert.equal(grid.length, 5)
  assert.deepEqual(grid[4], [-1, 1, -1, -1])
})

test('continuous batching gives a freed slot to the next waiting request', () => {
  const grid = schedule('continuous', [1, 3, 3, 3, 3], 4)
  assert.deepEqual(grid[0], [0, 1, 2, 3])
  assert.deepEqual(grid[1], [4, 1, 2, 3])
})

test('a short last batch still has a cell for every slot', () => {
  assert.equal(schedule('static', [2, 2, 2, 2, 2])[2].length, 4)
})

test('utilisation is the busy share of slot time', () => {
  assert.equal(utilisation([[0, -1], [0, 1]]), 0.75)
  assert.equal(utilisation([]), 0)
})
