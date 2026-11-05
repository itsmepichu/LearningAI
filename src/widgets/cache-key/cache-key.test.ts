import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { FIELD_IDS, evaluate, hitRate, keyPreview, type FieldId } from './key.ts'
import { casesFor, fieldLabel, loadCachedQuestion } from './scenarios.ts'

const ALL = new Set<FieldId>(FIELD_IDS)

test('the hit rate starts at 30% and each field lowers it', () => {
  assert.equal(hitRate(new Set()), 30)
  let rate = 30
  const on = new Set<FieldId>()
  for (const f of FIELD_IDS) {
    on.add(f)
    assert.ok(hitRate(on) < rate, f)
    rate = hitRate(on)
  }
})

test('the hit-rate multipliers match a hand calculation', () => {
  assert.ok(Math.abs(hitRate(new Set(['tenant', 'scope'])) - 30 * 0.6 * 0.7) < 1e-9)
})

test('the key preview always starts from the question and lists fields in a stable order', () => {
  assert.equal(keyPreview(new Set()), 'hash(normalised_question)')
  assert.equal(keyPreview(new Set(['scope', 'tenant'])), 'hash(normalised_question + tenant + scope)')
})

test('only tenant and scope count as security fields', () => {
  assert.equal(evaluate(new Set(['tenant']), []).securityPresent, false)
  assert.equal(evaluate(new Set(['tenant', 'scope']), []).securityPresent, true)
})

for (const id of PROJECT_IDS) {
  test(`${id}: one case per field, so all fields together leave nothing unsafe`, () => {
    const cases = casesFor(id)
    assert.deepEqual(cases.map((c) => c.needs).sort(), [...FIELD_IDS].sort())
    assert.equal(evaluate(new Set(), cases).unsafe, cases.length)
    assert.equal(evaluate(ALL, cases).unsafe, 0)
    const removed = new Set(ALL)
    removed.delete('scope')
    assert.deepEqual(evaluate(removed, cases).results.filter((r) => !r.safe).map((r) => r.needs), ['scope'])
    assert.ok(cases.every((c) => c.text && c.harm))
    assert.ok(!cases.some((c) => /undefined/.test(c.text + c.harm)))
    assert.ok(!cases.some((c) => /\b(rules) was\b/.test(c.text)), 'subject and verb agree')
    assert.ok(fieldLabel('tenant', id).includes('Tenant ID'))
  })

  test(`${id}: the cached question comes from the dataset`, async () => {
    const { question, file } = await loadCachedQuestion(projectOf(id), readerOf(id))
    assert.ok(question.trim().length > 5, question)
    assert.ok(file)
  })
}

test('severe outcomes are the two that leak data', () => {
  const { results } = evaluate(new Set(), casesFor('harbor'))
  assert.deepEqual(results.filter((r) => r.severe).map((r) => r.needs), ['tenant', 'scope'])
})
