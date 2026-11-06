import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildIndex, queryAt, searchIndex, POINT_COUNT } from '../hnsw/graph.ts'
import { checkSteps } from '../scene3d/testing.ts'
import { hnswSteps } from './layers.ts'

for (const q of [0, 1, 2, 3]) {
  test(`query ${q}: the steps replay the real search, top layer first, and end on its result`, () => {
    const steps = hnswSteps(q)
    checkSteps(steps)
    const res = searchIndex(buildIndex(), queryAt(q))
    const last = steps[steps.length - 1]
    assert.ok(last.text.includes(`point ${res.found}`))
    assert.ok(last.text.includes(`${res.computed} distance computations`))
    assert.ok(res.computed < POINT_COUNT)
    const drop = steps.findIndex((s) => s.title.startsWith('Drop'))
    assert.ok(drop > 0, 'the search drops a layer')
    steps.slice(0, drop).forEach((s) => assert.ok(!s.paths?.some((p) => p.id.startsWith('m')), 'no bottom-layer moves before the drop'))
    // the third axis is the layer: top-layer points sit above bottom-layer ones
    const ys = (prefix: string) => new Set(last.points!.filter((p) => p.id.startsWith(prefix)).map((p) => p.at[1]))
    assert.deepEqual([...ys('u')], [2.4])
    assert.deepEqual([...ys('b')], [0])
    assert.equal(steps[0].points!.length, POINT_COUNT + POINT_COUNT / 10 + 2)
  })
}
