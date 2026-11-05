import assert from 'node:assert/strict'
import { test } from 'node:test'
import { STORES, SURFACES, cellState } from './matrix.ts'

test('the example state has one failing test', () => {
  const failing = STORES.flatMap((st) => SURFACES.filter((su) => cellState(st, su) === 'fail').map((su) => `${st}|${su}`))
  assert.deepEqual(failing, ['Semantic cache|Agent tools'])
})

test('surfaces that do not touch a store are not applicable', () => {
  assert.equal(cellState('Prefix/KV cache', 'Data export'), 'na')
  assert.equal(cellState('Fine-tuned adapters', 'Data export'), 'na')
})

test('everything else passes', () => {
  assert.equal(cellState('Retrieval index', 'Chat API'), 'pass')
  const count = (state: string) => STORES.flatMap((st) => SURFACES.map((su) => cellState(st, su))).filter((c) => c === state).length
  assert.equal(count('pass') + count('fail') + count('na'), STORES.length * SURFACES.length)
  assert.equal(count('na'), 3)
})
