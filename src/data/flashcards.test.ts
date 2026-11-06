import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chapterOf, dueIds, formatWait, newCard, nextDue, preview, review } from './flashcards.ts'

const T0 = new Date('2026-11-06T10:00:00Z')
const at = (min: number) => new Date(T0.getTime() + min * 60_000)

test('a new card is due at once and survives a JSON round trip', () => {
  const c = newCard(T0)
  assert.equal(c.due, T0.toISOString())
  assert.deepEqual(JSON.parse(JSON.stringify(c)), c)
  assert.deepEqual(dueIds({ a: c }, T0), ['a'])
})

test('better grades schedule the card further ahead', () => {
  const p = preview(newCard(T0), T0)
  const t = (g: keyof typeof p) => p[g].getTime()
  assert.ok(t('again') < t('hard') && t('hard') < t('good') && t('good') < t('easy'))
  // "again" on a new card brings it back within minutes, inside the same session
  assert.ok(t('again') - T0.getTime() <= 10 * 60_000)
})

test('repeated good reviews space the card out, and a lapse brings it back soon', () => {
  let c = newCard(T0)
  let now = T0
  const waits: number[] = []
  for (let i = 0; i < 5; i++) {
    c = review(c, 'good', now)
    waits.push(Date.parse(c.due) - now.getTime())
    now = new Date(c.due)
  }
  for (let i = 1; i < waits.length; i++) assert.ok(waits[i] >= waits[i - 1], `wait ${i} did not grow: ${waits}`)
  assert.ok(waits.at(-1)! > 7 * 24 * 3600_000, 'after five good reviews the card is more than a week away')
  const lapsed = review(c, 'again', now)
  assert.equal(lapsed.lapses, 1)
  assert.ok(Date.parse(lapsed.due) - now.getTime() < 24 * 3600_000)
  assert.equal(lapsed.added, T0.toISOString())
})

test('the same reviews give the same schedule (no fuzz)', () => {
  const run = () => review(review(newCard(T0), 'good', T0), 'hard', at(20))
  assert.deepEqual(run(), run())
})

test('due ids come most overdue first; nextDue finds the earliest', () => {
  const cards = { late: { ...newCard(T0), due: at(-60).toISOString() }, soon: { ...newCard(T0), due: at(-5).toISOString() }, later: { ...newCard(T0), due: at(90).toISOString() } }
  assert.deepEqual(dueIds(cards, T0), ['late', 'soon'])
  assert.equal(nextDue(cards)?.toISOString(), at(-60).toISOString())
  assert.equal(nextDue({}), undefined)
})

test('helpers', () => {
  assert.equal(chapterOf('c10-2-m03'), 'c10')
  assert.equal(chapterOf('c5-3-i04'), 'c5')
  assert.equal(formatWait(30_000), '1 min')
  assert.equal(formatWait(10 * 60_000), '10 min')
  assert.equal(formatWait(3 * 3600_000), '3 h')
  assert.equal(formatWait(4 * 86400_000), '4 days')
  assert.equal(formatWait(60 * 86400_000), '2 mo')
})
