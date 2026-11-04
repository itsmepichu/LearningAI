import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { sagaEvents, type SagaStep } from './events.ts'
import { SAGAS, loadSagaRef } from './scenarios.ts'

const STEPS: SagaStep[] = [1, 2, 3, 4].map((n) => ({ action: `do${n}`, undo: n === 4 ? null : `undo${n}`, failure: `fail${n}` }))
const statuses = (failAt: number, retry: boolean) => sagaEvents(STEPS, 'R', failAt, retry).map((e) => e.status)

test('with no failure every step runs in order and the saga completes', () => {
  assert.deepEqual(statuses(-1, false), ['Done', 'Done', 'Done', 'Done', 'Saga completed'])
})

test('a failure compensates completed steps in reverse order, then stops', () => {
  const events = sagaEvents(STEPS, 'R', 2, false)
  assert.deepEqual(events.map((e) => e.status), ['Done', 'Done', 'Failed', 'Compensated', 'Compensated', 'Saga ended'])
  assert.deepEqual(events.filter((e) => e.status === 'Compensated').map((e) => e.title), ['Step 2: undo2', 'Step 1: undo1'])
})

test('the failure names the step that failed and its own reason', () => {
  const failed = sagaEvents(STEPS, 'R', 1, false).find((e) => e.status === 'Failed')!
  assert.equal(failed.title, 'Step 2: do2')
  assert.equal(failed.detail, 'fail2')
})

test('failing the last step undoes all three earlier ones', () => {
  assert.equal(statuses(3, false).filter((s) => s === 'Compensated').length, 3)
})

test('a step that cannot be undone is skipped, not compensated', () => {
  const steps: SagaStep[] = [{ action: 'a', undo: null, failure: 'x' }, { action: 'b', undo: 'undo b', failure: 'y' }, { action: 'c', undo: null, failure: 'z' }]
  assert.deepEqual(sagaEvents(steps, 'R', 2, false).filter((e) => e.status === 'Compensated').map((e) => e.title), ['Step 2: undo b'])
})

test('the retry reuses step 1 key and comes right after step 1', () => {
  const events = sagaEvents(STEPS, 'R', -1, true)
  assert.deepEqual(events.slice(0, 2).map((e) => e.status), ['Done', 'Retried'])
  assert.equal(events[1].code, events[0].code)
  assert.equal(events[0].code, 'R:1')
})

test('compensation keys differ from the forward keys', () => {
  const codes = sagaEvents(STEPS, 'R', 2, false).flatMap((e) => (e.code ? [e.code] : []))
  assert.deepEqual(codes, ['R:1', 'R:2', 'R:comp-2', 'R:comp-1'])
})

const REFERENCE = { harbor: /^T-\d+$/, store: /^OD-\d+$/, bank: /^DS-\d+$/, travel: /^SN-\d+$/ }

for (const id of PROJECT_IDS) {
  test(`${id}: the scenario ends on its one irreversible step`, () => {
    const { steps } = SAGAS[id]
    assert.equal(steps.length, 4)
    assert.equal(steps[3].undo, null)
    assert.ok(steps.slice(0, 3).every((s) => s.undo), 'every earlier step can be undone')
  })

  test(`${id}: failure reasons read as sentences`, () => {
    for (const s of SAGAS[id].steps) assert.match(s.failure, /^[A-Z].*[^.]$/, s.failure)
  })

  test(`${id}: the reference comes from the dataset`, async () => {
    const { file, ref } = await loadSagaRef(projectOf(id), readerOf(id))
    assert.match(ref, REFERENCE[id])
    assert.ok((await readerOf(id).csv(file)).length > 1)
  })
}
