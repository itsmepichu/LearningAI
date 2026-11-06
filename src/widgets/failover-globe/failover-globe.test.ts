import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS } from '../kit/testing.ts'
import { checkSteps } from '../scene3d/testing.ts'
import { SETUPS, assign, distanceKm, globeSteps, loads, rttMs } from './regions.ts'

test('great-circle distances match known values within a few km', () => {
  // Mumbai to Delhi is about 1,150 km; London to New York about 5,570 km.
  const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`)
  near(distanceKm({ name: 'Mumbai', lat: 19.08, lon: 72.88 }, { name: 'Delhi', lat: 28.61, lon: 77.21 }), 1150, 15)
  near(distanceKm({ name: 'London', lat: 51.51, lon: -0.13 }, { name: 'New York', lat: 40.71, lon: -74.01 }), 5570, 15)
  assert.equal(rttMs(1000), 15)
})

for (const id of PROJECT_IDS) {
  test(`${id}: shares sum to 1, residency is respected, and the steps hold up`, () => {
    const s = SETUPS[id]
    assert.ok(Math.abs(s.cities.reduce((n, c) => n + c.share, 0) - 1) < 1e-9)
    const after = assign(s, new Set([s.fails]))
    for (const c of s.cities) {
      const r = after.get(c.name)
      assert.ok(r && r !== s.fails, `${c.name} has somewhere to go`)
      if (c.allowed) assert.ok(c.allowed.includes(r!), `${c.name} stays where it is allowed`)
    }
    const total = [...loads(s, after).values()].reduce((a, b) => a + b, 0)
    assert.ok(Math.abs(total - 1) < 1e-9, 'all traffic is still served')
    const steps = globeSteps(id)
    checkSteps(steps)
    assert.equal(steps.length, 4)
    assert.ok(steps[1].points!.some((p) => p.tone === 'bad'), 'the failed region is marked')
    assert.match(steps[2].text, /% of what it can serve|within capacity/)
  })
}

test('the bank cannot fail over abroad, so its overflow has nowhere else to go', () => {
  assert.match(globeSteps('bank')[2].text, /nowhere else to go/)
  assert.match(globeSteps('harbor')[2].text, /nowhere else to go/, 'EU residency keeps Harbor’s EU overflow in Dublin')
})
