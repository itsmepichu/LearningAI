import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS } from '../kit/testing.ts'
import { GROUPINGS, TOTAL, spendRows } from './spend.ts'

for (const id of PROJECT_IDS) {
  test(`${id}: every grouping adds up to the same month`, () => {
    for (const g of GROUPINGS) {
      assert.equal(spendRows(id, g).reduce((n, [, d]) => n + d, 0), TOTAL, g)
    }
  })

  test(`${id}: the caption’s claims hold`, () => {
    const byFeature = spendRows(id, 'By feature')
    assert.equal(byFeature[0][1], Math.max(...byFeature.map(([, d]) => d)), 'the agent workflow is the largest cost')
    assert.match(byFeature[0][0], /agent|workflows/i)
    const [largest] = spendRows(id, 'By tenant')
    assert.ok(Math.abs(largest[1] / TOTAL - 0.31) < 0.005, 'one tenant is 31% of spend')
    const [output, uncached] = spendRows(id, 'By token type')
    assert.ok((output[1] + uncached[1]) / TOTAL > 0.8, 'output and uncached input dominate')
  })

  test(`${id}: labels are unique within a grouping`, () => {
    for (const g of GROUPINGS) {
      const labels = spendRows(id, g).map(([l]) => l)
      assert.equal(new Set(labels).size, labels.length, g)
    }
  })
}
