import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { STORIES, type StoryId } from './stories.ts'
import type { Story } from './story.ts'
import { RATES, timing } from './stories/serving.ts'
import { example, tokenLoss } from './stories/training.ts'
import { loadLabelled } from '../text-classifier/examples.ts'

for (const id of Object.keys(STORIES) as StoryId[]) {
  const story = STORIES[id] as unknown as Story<unknown>
  test(`${id}: the diagram is well formed`, () => {
    const ids = new Set(story.nodes.map((n) => n.id))
    assert.equal(ids.size, story.nodes.length)
    for (const e of story.edges) assert.ok(ids.has(e.from) && ids.has(e.to), `${e.from} → ${e.to}`)
    for (const n of story.nodes) assert.ok(n.x >= 56 && n.x <= 584 && n.y >= 21 && n.y <= 279, `${n.id} fits the 640 × 300 diagram`)
  })
  for (const pid of PROJECT_IDS) {
    test(`${id} · ${pid}: every step names real boxes and arrows, and its text is complete`, async () => {
      const p = projectOf(pid)
      const seed = await story.load(p, readerOf(pid))
      const steps = story.steps(p, seed)
      const ids = new Set(story.nodes.map((n) => n.id))
      const edges = new Set(story.edges.map((e) => `${e.from}>${e.to}`))
      assert.ok(steps.length >= 6)
      assert.equal(new Set(steps.map((s) => s.title)).size, steps.length)
      for (const s of steps) {
        assert.ok(s.nodes.length && s.nodes.every((n) => ids.has(n)), `${s.title}: nodes`)
        for (const [a, b] of s.edges ?? []) assert.ok(edges.has(`${a}>${b}`), `${s.title}: arrow ${a} → ${b}`)
        const text = s.text + JSON.stringify(s.detail ?? '')
        assert.doesNotMatch(text, /undefined|NaN|\[object/, s.title)
        assert.ok(s.text.length > 60, `${s.title}: says something`)
        if (s.detail?.kind === 'table') for (const r of s.detail.rows) assert.equal(r.length, s.detail.head.length)
      }
      assert.ok(story.note(p).length > 40)
      assert.ok(story.files(seed).length)
    })
  }
}

test('serving: time to first token is queue + prefill, and a cached system prompt only shortens prefill', () => {
  const cold = timing(60, 240, false)
  const warm = timing(60, 240, true)
  assert.equal(cold.prefillTokens, 300)
  assert.equal(warm.prefillTokens, 240)
  assert.ok(Math.abs(cold.ttftMs - (RATES.queueMs + 30)) < 1e-9)
  assert.equal(cold.itlMs, warm.itlMs)
  assert.ok(Math.abs(cold.totalMs - (cold.ttftMs + (RATES.outputTokens - 1) * cold.itlMs)) < 1e-9)
})

test('training: the answer is the row’s label as JSON, and the loss arithmetic is right', async () => {
  const set = await loadLabelled(projectOf('bank'), readerOf('bank'))
  const e = example({ company: 'X' }, set)
  assert.ok(e.answer.includes(set.rows[0].label))
  assert.ok(e.full.endsWith(`${e.answer}<|im_end|>`))
  assert.ok(e.promptTokens > e.answerTokens)
  assert.ok(Math.abs(tokenLoss(0.4) - 0.916) < 1e-3)
})

test('rag: Harbor’s filter hides policies a support agent may not read', async () => {
  const p = projectOf('harbor')
  const story = STORIES.rag
  const seed = await story.load(p, readerOf('harbor'))
  assert.ok(seed.harbor && seed.harbor.hidden.length > 0 && seed.harbor.old > 0)
  assert.ok(seed.bm25.length > 0, 'keyword search finds something')
})
