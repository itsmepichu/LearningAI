/** Checks every scene's steps must pass. For tests only. */
import assert from 'node:assert/strict'
import type { SceneStep } from './tensor.ts'

export function checkSteps(steps: SceneStep[]) {
  const counts = new Map<string, number>()
  assert.ok(steps.length >= 2)
  assert.equal(new Set(steps.map((s) => s.title)).size, steps.length, 'step titles are unique')
  for (const s of steps) {
    assert.ok(s.text.length > 40, `"${s.title}" needs a description`)
    const inFocus = [...s.tensors, ...(s.points ?? []), ...(s.bars ?? [])].some((t) => !t.faded)
    assert.ok(inFocus, `"${s.title}" shows something in focus`)
    for (const p of s.points ?? []) assert.ok(p.at.every(Number.isFinite), `${p.id}: a point needs a finite position`)
    for (const b of s.bars ?? []) assert.ok(b.size.every((v) => v >= 0) && b.at.every(Number.isFinite), `${b.id}: a bar needs a size and a place`)
    if (s.points) assert.equal(new Set(s.points.map((p) => p.id)).size, s.points.length, 'point ids are unique within a step')
    if (s.table) for (const r of s.table.rows) assert.equal(r.length, s.table.head.length, 'table rows match the header')
    assert.equal(new Set(s.tensors.map((t) => t.id)).size, s.tensors.length, 'ids are unique within a step')
    for (const t of s.tensors) {
      const prev = counts.get(t.id)
      if (prev !== undefined) assert.equal(t.cells.length, prev, `${t.id} keeps its cell count across steps, so its cells can move`)
      counts.set(t.id, t.cells.length)
      assert.equal(t.cells.length, t.slices.reduce((n, m) => n + m.length * m[0].length, 0), `${t.id}: the 2D view shows the same cells`)
      assert.ok(t.cells.every((c) => Number.isFinite(c.v) && c.at.every(Number.isFinite)))
      if (t.sliceNames) assert.equal(t.sliceNames.length, t.slices.length)
      if (t.kind === 'weight') assert.ok(t.cells.every((c) => c.v >= 0 && c.v <= 1))
      assert.ok(t.scale > 0)
    }
    assert.ok(s.distance > 0 && s.target.every(Number.isFinite))
  }
}
