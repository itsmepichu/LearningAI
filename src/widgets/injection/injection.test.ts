import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { DEFENCES, attackEvents, defenceLabel, type AttackScenario, type DefenceId } from './attack.ts'
import { loadInjection } from './scenarios.ts'

const S: AttackScenario = { source: 'email', request: 'r', readCall: 'read()', stolen: 'data', recipient: 'x@attacker.example' }
const last = (...on: DefenceId[]) => attackEvents(S, new Set(on)).at(-1)!

test('with no defence the data leaves', () => {
  assert.equal(last().tone, 'bad')
  assert.match(last().title, /exfiltrated/)
})

test('telling the model the text is data does not stop it on its own', () => {
  assert.equal(last('untrusted').tone, 'bad')
  assert.ok(attackEvents(S, new Set(['untrusted'])).some((e) => e.status === 'Not enough'))
})

test('each other layer stops the attack by itself', () => {
  for (const d of ['classifier', 'readonly', 'egress'] as const) assert.equal(last(d).tone, 'ok', d)
})

test('human confirmation stops it, but is flagged as depending on the user', () => {
  assert.equal(last('confirm').tone, 'warn')
  assert.match(last('confirm').title, /user noticed/)
})

test('a classifier stops the attack before any tool runs', () => {
  assert.ok(!attackEvents(S, new Set(['classifier'])).some((e) => e.title.includes('read()')))
})

test('the read call is allowed unless the classifier has already stopped it', () => {
  for (const d of ['readonly', 'egress', 'confirm', 'untrusted'] as const) {
    assert.ok(attackEvents(S, new Set([d])).some((e) => e.title.includes('read()')), d)
  }
})

test('labels name the content, and keep the wording the notes quote', () => {
  assert.equal(defenceLabel('untrusted', S).toLowerCase().startsWith('mark email content as untrusted data'), true)
  assert.match(defenceLabel('confirm', S), /^send_email needs the user to confirm/)
  assert.match(defenceLabel('egress', S), /^Egress allowlist/)
  assert.match(defenceLabel('readonly', S), /^Read-only tools while untrusted content is in context/)
  assert.equal(DEFENCES.length, 5)
})

for (const id of PROJECT_IDS) {
  test(`${id}: the attacker's text is marked, and its address is reserved`, async () => {
    const s = await loadInjection(projectOf(id), readerOf(id))
    const hidden = s.doc.filter((d) => d.hidden).map((d) => d.text).join(' ')
    assert.ok(hidden.trim(), 'some text is marked as the attack')
    assert.match(s.recipient, /\.example$/)
    const addresses = s.doc.map((d) => d.text).join(' ').match(/[\w.-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []
    assert.ok(addresses.length > 0)
    assert.ok(addresses.every((a) => a.endsWith('.example')), `only reserved domains: ${addresses}`)
  })
}

test('store: the attack is the injection review from the dataset, not an invented one', async () => {
  const s = await loadInjection(projectOf('store'), readerOf('store'))
  const reviews = await readerOf('store').json<{ text: string; is_injection: boolean }[]>('reviews.json')
  const full = s.doc.map((d) => d.text).join('')
  const match = reviews.find((r) => full.includes(r.text))
  assert.ok(match, 'the review text appears whole')
  assert.equal(match.is_injection, true)
})

test('bank: the case text comes from the dataset', async () => {
  const s = await loadInjection(projectOf('bank'), readerOf('bank'))
  const [row] = await readerOf('bank').csv('disputes.csv', 1)
  assert.ok(s.doc.some((d) => d.text.includes(row.text)))
})
