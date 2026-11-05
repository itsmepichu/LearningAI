import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS } from '../kit/testing.ts'
import { WRITES, writeEvents } from './events.ts'

const S = WRITES.harbor

test('with a key, the retry returns the stored record and there is one row', () => {
  const events = writeEvents(S, 'R', true)
  assert.equal(events.length, 6)
  assert.equal(events.at(-1)!.rows.length, 1)
  assert.equal(events.at(-1)!.tone, 'ok')
  assert.equal(events[0].code, 'task-77:create_ticket:R')
  assert.equal(events[4].code, events[0].code)
})

test('without a key, the retry creates a duplicate and names the harm', () => {
  const events = writeEvents(S, 'R', false)
  assert.equal(events.at(-1)!.rows.length, 2)
  assert.equal(events.at(-1)!.tone, 'bad')
  assert.equal(events.at(-1)!.detail, S.harm)
  assert.equal(events[0].code, undefined)
})

test('the store is empty until the server commits, and the lost response does not undo it', () => {
  for (const withKey of [true, false]) {
    assert.deepEqual(writeEvents(S, 'R', withKey).map((e) => e.rows.length).slice(0, 4), [0, 1, 1, 1])
  }
})

for (const id of PROJECT_IDS) {
  test(`${id}: names its own tool, record and harm`, () => {
    const s = WRITES[id]
    assert.ok(s.tool && s.record && s.harm)
    assert.match(writeEvents(s, 'R', false)[1].title, new RegExp(s.record))
    assert.ok(!s.harm.endsWith('.'), 'the event list adds the full stop')
  })
}
