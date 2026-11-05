import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HOURS, SCENARIOS, alertMarkers, errorRates, firstAlertDay, simulateBurn, type Scenario } from './simulate.ts'

const SLO = 99.9
const SCENARIO_IDS = Object.keys(SCENARIOS) as Scenario[]

test('a month is seeded, with one rate per hour', () => {
  assert.deepEqual(errorRates('calm', 0.001), errorRates('calm', 0.001))
  assert.equal(errorRates('calm', 0.001).length, HOURS)
})

test('the budget follows from the SLO', () => {
  assert.ok(Math.abs(simulateBurn('calm', 99.9).budget - 0.001) < 1e-9)
  assert.ok(Math.abs(simulateBurn('calm', 99.5).budget - 0.005) < 1e-9)
})

test('the budget remaining only falls, and matches the budget used', () => {
  for (const id of SCENARIO_IDS) {
    const { remaining, used } = simulateBurn(id, SLO)
    remaining.slice(1).forEach((v, i) => assert.ok(v <= remaining[i], `${id} hour ${i}`))
    assert.ok(Math.abs(remaining.at(-1)! - (1 - used)) < 1e-9, id)
  }
})

test('a normal month pages nobody and spends little of the budget', () => {
  const { alerts, used } = simulateBurn('calm', SLO)
  assert.equal(firstAlertDay(alerts, 'fast'), null)
  assert.equal(firstAlertDay(alerts, 'slow'), null)
  assert.ok(used < 0.5)
})

test('the caption’s claim: a sharp incident pages within an hour', () => {
  const { alerts } = simulateBurn('spike', SLO)
  assert.equal(alerts.find((a) => a.kind === 'fast')!.hour, 400)
})

test('the caption’s claim: a slow leak never trips the fast rule, but drains the budget', () => {
  const leak = simulateBurn('leak', SLO)
  const calm = simulateBurn('calm', SLO)
  assert.equal(firstAlertDay(leak.alerts, 'fast'), null)
  assert.ok(leak.used > calm.used * 1.5, `${leak.used} and ${calm.used}`)
  assert.notEqual(firstAlertDay(leak.alerts, 'ticket'), null)
})

test('the first-alert day converts hours to days', () => {
  assert.equal(firstAlertDay([{ hour: 36, kind: 'slow' }], 'slow'), 1.5)
  assert.equal(firstAlertDay([{ hour: 36, kind: 'slow' }], 'fast'), null)
})

test('markers collapse an hourly run of alerts to one per kind per half day', () => {
  const alerts = [
    { hour: 1, kind: 'fast' as const },
    { hour: 2, kind: 'fast' as const },
    { hour: 2, kind: 'ticket' as const },
    { hour: 13, kind: 'fast' as const },
  ]
  assert.deepEqual(alertMarkers(alerts), [alerts[0], alerts[2], alerts[3]])
})
