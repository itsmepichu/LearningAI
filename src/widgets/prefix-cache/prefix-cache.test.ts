import assert from 'node:assert/strict'
import { test } from 'node:test'
import { prefixCost } from './cost.ts'

const BASE = { prefixTokens: 6000, uniqueTokens: 800, hitRate: 0.8, speed: 10000, price: 3, discount: 0.9 }
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`)

test('first-token times match a hand calculation', () => {
  const c = prefixCost(BASE)
  close(c.ttftHit, 0.08 + 0.08)
  close(c.ttftMiss, 0.08 + 0.68)
  close(c.ttftAverage, 0.8 * 0.16 + 0.2 * 0.76)
})

test('the cost matches a hand calculation', () => {
  const hit = ((6000 * 0.1 + 800) / 1e6) * 3
  const miss = ((6000 + 800) / 1e6) * 3
  const c = prefixCost(BASE)
  close(c.costPerThousand, (0.8 * hit + 0.2 * miss) * 1000)
  close(c.saving, 1 - (0.8 * hit + 0.2 * miss) / miss)
})

test('a hit rate of zero saves nothing, and matches a miss', () => {
  const c = prefixCost({ ...BASE, hitRate: 0 })
  close(c.saving, 0)
  close(c.ttftAverage, c.ttftMiss)
})

test('a hit rate of one matches a hit', () => {
  const c = prefixCost({ ...BASE, hitRate: 1 })
  close(c.ttftAverage, c.ttftHit)
})

test('a higher hit rate lowers both first-token time and cost', () => {
  const low = prefixCost({ ...BASE, hitRate: 0.2 })
  const high = prefixCost(BASE)
  assert.ok(high.ttftAverage < low.ttftAverage)
  assert.ok(high.costPerThousand < low.costPerThousand)
})

test('no discount means caching saves time but no money', () => {
  const c = prefixCost({ ...BASE, discount: 0 })
  close(c.saving, 0)
  assert.ok(c.ttftAverage < c.ttftMiss)
})

test('no prefix means nothing to cache', () => {
  const c = prefixCost({ ...BASE, prefixTokens: 0 })
  close(c.ttftHit, c.ttftMiss)
  close(c.saving, 0)
})
