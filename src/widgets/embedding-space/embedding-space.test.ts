import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { loadLabelled } from '../text-classifier/examples.ts'
import { checkSteps } from '../scene3d/testing.ts'
import type { Tone } from '../scene3d/tensor.ts'
import { cosine, labelAgreement, neighbours, pca3, spaceSteps, tfidf } from './space.ts'

test('PCA finds the direction of most spread first, and reports the share it keeps', () => {
  // Points spread along x a lot, along y a little, along z barely: PCA should put x first.
  const vs = Array.from({ length: 60 }, (_, i) => [Math.sin(i) * 5, Math.cos(i * 1.7) * 1, Math.sin(i * 2.3) * 0.1])
  const p = pca3(vs)
  assert.ok(p.explained[0] > p.explained[1] && p.explained[1] > p.explained[2])
  assert.ok(Math.abs(p.explained.reduce((a, b) => a + b) - 1) < 1e-3, 'three components of three dimensions keep all the variance')
  assert.ok(p.coords.every((c) => c.every((v) => Math.abs(v) <= 3 + 1e-9)))
})

test('cosine and neighbours: a row is never its own neighbour, and the order is by similarity', () => {
  assert.equal(cosine([1, 0], [2, 0]), 1)
  const vs = [[1, 0], [0.9, 0.1], [0, 1], [0.5, 0.5]]
  const n = neighbours(vs, 0, 3)
  assert.deepEqual(n.map((x) => x.index), [1, 3, 2])
})

for (const id of PROJECT_IDS) {
  test(`${id}: TF-IDF puts same-label rows together more often than chance, and the steps hold up`, async () => {
    const set = await loadLabelled(projectOf(id), readerOf(id))
    const { vectors, vocabulary } = tfidf(set.rows.map((r) => r.text))
    assert.ok(vocabulary.length > 50)
    for (const v of vectors) {
      const len = Math.hypot(...v)
      assert.ok(len === 0 || Math.abs(len - 1) < 1e-9)
    }
    const labels = set.rows.map((r) => r.label)
    const agreement = labelAgreement(vectors, labels)
    assert.ok(agreement.agreement > agreement.chance, `${id}: ${agreement.agreement} vs chance ${agreement.chance}`)
    const projection = pca3(vectors)
    const tones = new Map<string, Tone>([...new Set(labels)].map((l, i) => [l, `series${i % 6}` as Tone]))
    const steps = spaceSteps({ rows: set.rows, vectors, projection, agreement, focus: 0, labelTones: tones, noun: set.noun, target: set.target, kind: 'TF-IDF word counts' })
    checkSteps(steps)
    assert.equal(steps[0].points!.length, set.rows.length)
    assert.equal(steps[1].paths!.length, 5, 'five neighbour lines')
    assert.ok(steps[0].text.includes('%'))
  })
}
