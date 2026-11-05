import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matmul } from '../scene3d/tensor.ts'
import { D, DH, HEADS, N, attend, lastTokenFocus, multiheadSteps } from './steps.ts'
import { checkSteps } from '../scene3d/testing.ts'

test('every head is a causal softmax, and each output is that head’s weights times its values', () => {
  const t = attend(7)
  assert.equal(t.a.length, HEADS)
  for (let h = 0; h < HEADS; h++) {
    t.a[h].forEach((row, i) => {
      assert.ok(Math.abs(row.reduce((s, v) => s + v, 0) - 1) < 1e-9)
      row.forEach((v, j) => j > i && assert.equal(v, 0))
    })
    const vh = t.v.map((row) => row.slice(h * DH, (h + 1) * DH))
    assert.deepEqual(t.o[h], matmul(t.a[h], vh))
  }
  assert.equal(t.y.length, N)
  assert.equal(t.y[0].length, D)
})

test('random weights give heads that differ', () => {
  const a = attend(7).a
  assert.notDeepEqual(a[0], a[1])
})

test('the steps are consistent, and the third axis is used only once heads exist', () => {
  const steps = multiheadSteps(7)
  checkSteps(steps)
  const depth = (i: number, id: string) => new Set(steps[i].tensors.find((t) => t.id === id)!.cells.map((c) => c.at[2])).size
  assert.equal(depth(1, 'q'), 1)
  assert.equal(depth(2, 'q'), HEADS)
  assert.equal(depth(4, 'o'), HEADS)
  assert.equal(depth(5, 'o'), 1, 'concatenated heads lie flat again')
})

test('the text reports the weights the scene shows', () => {
  const t = attend(7)
  const text = multiheadSteps(7)[3].text
  for (const f of lastTokenFocus(t.a)) assert.ok(text.includes(`“${f.token}”`))
})
