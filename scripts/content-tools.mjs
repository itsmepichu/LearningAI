// Authoring helpers for practice notes and chapter checks (Node; needs Node 22.18 or later, which runs the .ts import below).
//
// Write content as JavaScript in a batch module, then merge it into the JSON files:
//
//   import { M, I, F, A, S, C, mergePractice, mergeChecks } from './content-tools.mjs'
//   mergePractice('c4', { 'c4-1': { store: { practice: '…', failure: '…', tryIt: '…', fit: 'good', fitNote: '…' } }, _lab: { … } })
//   mergeChecks({ 'c4-1': { mcq: [M(…), …], interview: [I(…), …] } })
//
// Run it with `node my-batch.mjs`. Do not commit the batch module.
//
// What the tools do (see src/content/CLAUDE.md):
//   * Existing notes are updated field by field; Harbor's existing practice and failure are kept.
//   * New questions get the next free stable id in their section; an identical question text is skipped.
//   * New choose-the-answer options are shuffled with a seed taken from the question id, so the right answer's
//     position varies. Published questions are never reshuffled (saved answers are option indices).
//   * reviseChecks edits published questions by id and refuses to change an answer or the number of options.
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { mulberry } from '../src/widgets/kit/random.ts'
import { CONTENT, PROJECTS, existsSync, readJson, readText, unescapeHtml, writeJson } from './lib/content.mjs'

export const F = 'fundamentals'
export const A = 'applied'
export const S = 'system-design'

/** Inline code. */
export const C = (s) => `<code>${s}</code>`

/** A choose-the-answer question. `answer` is an option index, or an array of indices for "choose all". */
export function M(q, options, answer, why, distractors, kind = 'concept') {
  const d = { q, options, answer, why, kind }
  if (distractors) d.distractors = distractors
  return d
}

/** An interview question. `level` is F, A or S. */
export function I(q, level, covers, followUp, project) {
  const d = { q, level, covers }
  if (followUp) d.followUp = followUp
  if (project) d.project = project
  return d
}

const assert = (ok, ...msg) => {
  if (!ok) throw new Error(msg.join(' '))
}
const asList = (a) => (Array.isArray(a) ? a : [a])

function shuffle(q, salt = 0) {
  const n = q.options.length
  const seed = parseInt(createHash('sha256').update(`${q.id}:${salt}`).digest('hex').slice(0, 8), 16)
  const r = mulberry(seed)
  const perm = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  const inv = new Map(perm.map((old, now) => [old, now]))
  q.options = perm.map((old) => q.options[old])
  if (q.distractors) q.distractors = perm.map((old) => q.distractors[old])
  q.answer = Array.isArray(q.answer) ? q.answer.map((a) => inv.get(a)).sort((a, b) => a - b) : inv.get(q.answer)
}

function maxShare(qs) {
  const pos = qs.filter((q) => Number.isInteger(q.answer)).map((q) => q.answer)
  return pos.length ? Math.max(...[0, 1, 2, 3].map((i) => pos.filter((p) => p === i).length)) / pos.length : 0
}

/** Merge practice notes into src/content/practice/<chapter>.json. Returns the number of projects per topic. */
export function mergePractice(chapter, data) {
  const path = join(CONTENT, 'practice', `${chapter}.json`)
  const cur = existsSync(path) ? readJson(path) : {}
  for (const [tid, byProject] of Object.entries(data)) {
    if (tid === '_lab') {
      cur._lab = { ...(cur._lab ?? {}), ...byProject }
      continue
    }
    cur[tid] ??= {}
    for (const [pid, note] of Object.entries(byProject)) {
      assert(PROJECTS.includes(pid), 'unknown project', pid)
      const base = { ...(cur[tid][pid] ?? {}), ...note }
      assert(base.practice && base.failure, tid, pid, 'needs practice and failure')
      for (const k of ['practice', 'failure', 'tryIt', 'fitNote']) {
        const stray = (base[k] ?? '').replace(/\{(company|assistant)\}/g, '')
        assert(!/[{}]/.test(stray), tid, pid, k, 'stray brace')
      }
      cur[tid][pid] = base
    }
    cur[tid] = Object.fromEntries(PROJECTS.filter((k) => k in cur[tid]).map((k) => [k, cur[tid][k]]))
  }
  writeJson(path, cur)
  return Object.fromEntries(Object.entries(cur).map(([t, v]) => [t, Object.keys(v).length]))
}

/** Merge questions into src/content/checks/<chapter>.json. Returns [mcq count, interview count] per section. */
export function mergeChecks(Q) {
  const out = {}
  for (const [tid, sec] of Object.entries(Q)) {
    const ch = tid.split('-')[0]
    const path = join(CONTENT, 'checks', `${ch}.json`)
    const data = existsSync(path) ? readJson(path) : {}
    const cur = (data[tid] ??= {})
    cur.mcq ??= []
    cur.interview ??= []
    const known = new Set([...cur.mcq, ...cur.interview].map((q) => q.q))
    const added = []
    for (const [key, letter] of [['mcq', 'm'], ['interview', 'i']]) {
      for (let q of sec[key] ?? []) {
        if (known.has(q.q)) continue
        const re = new RegExp(`^${tid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-${letter}(\\d+)$`)
        const nums = cur[key].map((x) => re.exec(x.id)).filter(Boolean).map((m) => parseInt(m[1], 10))
        q = { id: `${tid}-${letter}${String(Math.max(0, ...nums) + 1).padStart(2, '0')}`, ...q }
        cur[key].push(q)
        if (key === 'mcq') added.push(q)
      }
    }
    for (const q of added) shuffle(q)
    let salt = 0
    while (added.length && maxShare(cur.mcq) > 0.5 && salt < 20) {
      salt++
      for (const q of added) shuffle(q, salt)
    }
    for (const q of cur.mcq) {
      if (!q.distractors) continue
      const right = new Set(asList(q.answer))
      q.distractors.forEach((d, i) => assert(right.has(i) === (d === ''), q.id, 'distractor misaligned at option', i))
    }
    writeJson(path, data)
    out[tid] = [cur.mcq.length, cur.interview.length]
  }
  return out
}

/** Plain text of a topic page, for reading while writing questions. */
export function topicText(chapter, topic) {
  let s = readText(join(CONTENT, 'pages', chapter, `${topic}.html`))
  s = s.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<pre>[\s\S]*?<\/pre>/g, ' [code] ')
  s = s.replace(/<\/(p|li|h4|h5|div|figcaption|tr)>/g, '\n')
  s = unescapeHtml(s.replace(/<[^>]+>/g, ' '))
  return s.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()
}

const REVISABLE = new Set(['q', 'options', 'why', 'distractors', 'kind', 'followUp', 'covers'])

/**
 * Edit published questions in place, by id: reviseChecks('c1', { 'c1-2-m03': { options: [...], distractors: [...] }, 'c1-2-i04': { followUp: '...' } }).
 * Saved answers and Practice history are keyed by id and option index, so this refuses any change that would move them:
 * the number of options stays the same and the answer is never edited. Reword options in place, keeping each option's
 * meaning (the right one stays right). Returns how many questions were edited.
 */
export function reviseChecks(chapter, edits) {
  const path = join(CONTENT, 'checks', `${chapter}.json`)
  const data = readJson(path)
  const byId = new Map()
  for (const sec of Object.values(data)) for (const key of ['mcq', 'interview']) for (const q of sec[key] ?? []) byId.set(q.id, q)
  for (const [qid, change] of Object.entries(edits)) {
    const q = byId.get(qid)
    assert(q, 'unknown question', qid)
    const bad = Object.keys(change).filter((k) => !REVISABLE.has(k))
    assert(!bad.length, `${qid}: cannot revise ${bad.sort()} (ids, answers and levels stay as published)`)
    if (change.options) assert(change.options.length === q.options.length, `${qid}: the number of options must not change`)
    Object.assign(q, change)
    if (q.distractors) {
      const right = new Set(asList(q.answer))
      assert(q.distractors.length === q.options.length, `${qid}: distractors must align with options`)
      q.distractors.forEach((d, i) => assert(right.has(i) === (d === ''), `${qid}: distractor misaligned at option ${i}`))
    }
  }
  writeJson(path, data)
  return Object.keys(edits).length
}

