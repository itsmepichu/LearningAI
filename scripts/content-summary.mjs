// Validates practice notes and chapter checks, then writes src/content/checks/summary.json
// (question counts per chapter and section, so pages can show counts without loading every file).
// Runs automatically before `npm run dev` and `npm run build`; exits non-zero on any content error.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = join(process.cwd(), 'src', 'content')
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))
const projects = JSON.parse(readFileSync(join(root, 'projects.json'), 'utf8')).projects.map((p) => p.id)
const topicIds = new Set(manifest.chapters.flatMap((c) => c.topics.map((t) => t.id)))
const errors = []
const warnings = []
const err = (where, msg) => errors.push(`${where}: ${msg}`)

// ---- practice notes
const FITS = new Set(['best', 'good', 'limited'])
for (const f of readdirSync(join(root, 'practice')).filter((x) => x.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(join(root, 'practice', f), 'utf8'))
  for (const [tid, byProject] of Object.entries(data)) {
    if (tid !== '_lab' && !topicIds.has(tid)) err(f, `unknown topic ${tid}`)
    for (const [pid, note] of Object.entries(byProject)) {
      if (!projects.includes(pid)) err(`${f} ${tid}`, `unknown project ${pid}`)
      if (tid === '_lab') {
        if (!note.scenario) err(`${f} _lab ${pid}`, 'missing scenario')
        continue
      }
      if (!note.practice || !note.failure) err(`${f} ${tid} ${pid}`, 'needs practice and failure')
      if (note.fit && !FITS.has(note.fit)) err(`${f} ${tid} ${pid}`, `bad fit ${note.fit}`)
      if (note.fit === 'limited' && !Object.values(byProject).some((n) => n.fit === 'best' || n.fit === 'good'))
        err(`${f} ${tid}`, 'a limited fit needs at least one other project rated best or good')
    }
  }
}

// ---- chapter checks
const LEVELS = new Set(['fundamentals', 'applied', 'system-design'])
const KINDS = new Set(['concept', 'calculation', 'scenario'])
const seen = new Set()
const summary = { totals: { mcq: 0, interview: 0 }, chapters: {} }
for (const c of manifest.chapters) {
  const file = join(root, 'checks', `${c.id}.json`)
  if (!existsSync(file)) continue
  const data = JSON.parse(readFileSync(file, 'utf8'))
  const ch = { mcq: 0, interview: 0, sections: {} }
  for (const [tid, sec] of Object.entries(data)) {
    if (!c.topics.some((t) => t.id === tid)) err(`${c.id}.json`, `section ${tid} is not a topic of ${c.id}`)
    for (const q of sec.mcq ?? []) {
      const w = `${c.id}.json ${q.id}`
      if (!q.id?.startsWith(tid + '-m')) err(w, 'mcq id must start with <topic>-m')
      if (seen.has(q.id)) err(w, 'duplicate id')
      seen.add(q.id)
      if (!q.q || !Array.isArray(q.options) || q.options.length < 2) err(w, 'needs q and at least 2 options')
      const ans = Array.isArray(q.answer) ? q.answer : [q.answer]
      if (!ans.length || ans.some((a) => !Number.isInteger(a) || a < 0 || a >= q.options.length)) err(w, 'answer index out of range')
      if (!q.why) err(w, 'missing why')
      if (q.kind && !KINDS.has(q.kind)) err(w, `bad kind ${q.kind}`)
      if (q.distractors && q.distractors.length !== q.options.length) err(w, 'distractors must align with options (use "" for the right answer)')
    }
    for (const q of sec.interview ?? []) {
      const w = `${c.id}.json ${q.id}`
      if (!q.id?.startsWith(tid + '-i')) err(w, 'interview id must start with <topic>-i')
      if (seen.has(q.id)) err(w, 'duplicate id')
      seen.add(q.id)
      if (!q.q || !Array.isArray(q.covers) || q.covers.length < 2) err(w, 'needs q and at least 2 covers points')
      if (!LEVELS.has(q.level)) err(w, `bad level ${q.level}`)
      if (q.project && !projects.includes(q.project)) err(w, `unknown project ${q.project}`)
    }
    // warn when the right answer sits in the same position too often (readers learn to pick it)
    const pos = (sec.mcq ?? []).filter((q) => Number.isInteger(q.answer)).map((q) => q.answer)
    if (pos.length >= 6) {
      const top = Math.max(...[0, 1, 2, 3].map((i) => pos.filter((x) => x === i).length))
      if (top / pos.length > 0.5) warnings.push(`${c.id}.json ${tid}: ${top} of ${pos.length} answers in one position`)
    }
    const framed = (sec.interview ?? []).filter((q) => q.project).length
    if (framed > 2) err(`${c.id}.json ${tid}`, `${framed} project-framed interview questions (max 2)`)
    const s = { mcq: (sec.mcq ?? []).length, interview: (sec.interview ?? []).length }
    ch.sections[tid] = s
    ch.mcq += s.mcq
    ch.interview += s.interview
  }
  summary.chapters[c.id] = ch
  summary.totals.mcq += ch.mcq
  summary.totals.interview += ch.interview
}

if (errors.length) {
  console.error('Content errors:\n- ' + errors.join('\n- '))
  process.exit(1)
}
if (warnings.length) console.warn('Content warnings:\n- ' + warnings.join('\n- '))
writeFileSync(join(root, 'checks', 'summary.json'), JSON.stringify(summary, null, 1) + '\n')
console.log(`content ok · ${summary.totals.mcq} choose-the-answer · ${summary.totals.interview} interview questions`)
