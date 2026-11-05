import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS } from '../kit/testing.ts'
import { SAMPLES, luhn, redact } from './redact.ts'

const out = (s: string) => redact(s).pieces.map((p) => p.text).join('')

test('the Luhn check accepts test card numbers and rejects a changed digit', () => {
  assert.equal(luhn('4111 1111 1111 1111'), true)
  assert.equal(luhn('4111 1111 1111 1112'), false)
  assert.equal(luhn('5500-0000-0000-0004'), true)
  assert.equal(luhn('4111'), false, 'too short to be a card')
})

test('emails, phone numbers and cards become numbered tags', () => {
  assert.equal(out('Write to a@example.com or b@example.com'), 'Write to [EMAIL_1] or [EMAIL_2]')
  assert.equal(out('Call +1 415 555 0134 today'), 'Call [PHONE_1] today')
  assert.equal(out('Card 4111 1111 1111 1111.'), 'Card [CARD_1].')
})

test('an IBAN is not mistaken for a phone number', () => {
  assert.equal(out('IBAN DE89 3704 0044 0532 0130 00'), 'IBAN [IBAN_1]')
})

test('a long number that fails Luhn is not called a card, though the phone pattern still takes it', () => {
  const r = redact('Ref 4111 1111 1111 1112')
  assert.equal(r.counts.CARD, undefined)
  assert.equal(r.counts.PHONE, 1)
})

test('names and short numbers get through, which is the limit the caption states', () => {
  assert.equal(out('Dana Whitfield, order 1043'), 'Dana Whitfield, order 1043')
  assert.deepEqual(redact('Dana Whitfield').counts, {})
})

test('tags are marked, plain text is not, and the counts agree', () => {
  const r = redact('a@example.com and text')
  assert.deepEqual(r.pieces, [{ text: '[EMAIL_1]', tag: '[EMAIL_1]' }, { text: ' and text' }])
  assert.deepEqual(r.counts, { EMAIL: 1 })
})

test('empty text is safe', () => {
  assert.deepEqual(redact(''), { pieces: [], counts: {} })
})

for (const id of PROJECT_IDS) {
  test(`${id}: the sample shows the patterns working and a name getting through`, () => {
    const { counts, pieces } = redact(SAMPLES[id])
    assert.equal(counts.EMAIL, 1)
    assert.equal(counts.PHONE, 1)
    assert.equal(counts.CARD, 1)
    const text = pieces.map((p) => p.text).join('')
    assert.ok(!text.includes('@example.com'))
    assert.ok(!text.includes('4111'))
    assert.match(text, /[A-Z][a-z]+ [A-Z][a-z]+/, 'a name is left in the output')
  })

  test(`${id}: the sample uses only test values`, () => {
    const emails = SAMPLES[id].match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? []
    assert.ok(emails.every((e) => e.endsWith('@example.com')), emails.join())
    assert.ok(SAMPLES[id].includes('4111 1111 1111 1111'))
  })
}

test('bank: a UPI ID is not caught, which the figure lets the reader notice', () => {
  assert.ok(out(SAMPLES.bank).includes('kiran@examplebank'))
})
