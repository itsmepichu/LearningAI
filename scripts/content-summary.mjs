// Validates practice notes and chapter checks, then writes src/content/checks/summary.json
// (question counts per chapter and section, so pages can show counts without loading every file).
// Runs automatically before `npm run dev` and `npm run build`; exits non-zero on any content error.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import katex from 'katex'

const root = join(process.cwd(), 'src', 'content')
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))
const projects = JSON.parse(readFileSync(join(root, 'projects.json'), 'utf8')).projects.map((p) => p.id)
const topicIds = new Set(manifest.chapters.flatMap((c) => c.topics.map((t) => t.id)))
const errors = []
const warnings = []
const err = (where, msg) => errors.push(`${where}: ${msg}`)
// Quality rules from the pilot review (November 2026), enforced as errors since phase 6b fixed the whole bank.
const QUALITY = {
  followup: 'interview question without a likely follow-up',
  distractors: 'choose-the-answer question without an explanation for each wrong option',
  longest: 'right answer is the longest option by far (at least 1.4 times the wrong options’ average length), which gives it away',
  'concept-heavy': 'section with fewer than 4 scenario or calculation questions out of its choose-the-answer questions',
  'duplicate-text': 'question text that repeats another question’s, in this section or another',
}
const flag = (rule, where) => err(where, QUALITY[rule])
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
const texts = new Map()

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
      if (!q.distractors) flag('distractors', w)
      if (Number.isInteger(q.answer) && q.options.length > 1) {
        const others = q.options.filter((_, i) => i !== q.answer).map((o) => o.length)
        const mean = others.reduce((a, b) => a + b, 0) / others.length
        if (q.options[q.answer].length > Math.max(...others) && q.options[q.answer].length >= 1.4 * mean) flag('longest', w)
      }
    }
    for (const q of sec.interview ?? []) {
      const w = `${c.id}.json ${q.id}`
      if (!q.id?.startsWith(tid + '-i')) err(w, 'interview id must start with <topic>-i')
      if (seen.has(q.id)) err(w, 'duplicate id')
      seen.add(q.id)
      if (!q.q || !Array.isArray(q.covers) || q.covers.length < 2) err(w, 'needs q and at least 2 covers points')
      if (!LEVELS.has(q.level)) err(w, `bad level ${q.level}`)
      if (q.project && !projects.includes(q.project)) err(w, `unknown project ${q.project}`)
      if (!q.followUp) flag('followup', w)
    }
    for (const q of [...(sec.mcq ?? []), ...(sec.interview ?? [])]) {
      const key = norm(q.q ?? '')
      if (texts.has(key)) flag('duplicate-text', `${c.id}.json ${q.id} (same as ${texts.get(key)})`)
      else texts.set(key, q.id)
    }
    const applied = (sec.mcq ?? []).filter((q) => q.kind === 'scenario' || q.kind === 'calculation').length
    if ((sec.mcq ?? []).length && applied < 4) flag('concept-heavy', `${c.id}.json ${tid} (${applied} of ${(sec.mcq ?? []).length})`)
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

// ---- Topic pages: math, glossary links and the topic structure ----
// A structured topic has, in this order: Intuition, Mechanism, Math, Code, the practice block, Primary sources.
const PARTS = ['intuition', 'mechanism', 'math', 'code', 'sources']
const glossary = JSON.parse(readFileSync(join(root, 'glossary.json'), 'utf8'))
for (const [id, e] of Object.entries(glossary)) {
  if (!/^[a-z0-9-]+$/.test(id)) err(`glossary ${id}`, 'ids are lowercase letters, digits and hyphens')
  if (!e.term || !e.def) err(`glossary ${id}`, 'needs term and def')
  if (!topicIds.has(e.topic)) err(`glossary ${id}`, `unknown topic ${e.topic}`)
}
const snippetSrc = readFileSync(join(process.cwd(), 'src', 'widgets', 'py-snippet', 'snippets.ts'), 'utf8')
const SNIPPET_IDS = new Set([...snippetSrc.slice(snippetSrc.indexOf('export const SNIPPETS')).matchAll(/^  ([a-z][\w-]*): \{$/gm)].map((m) => m[1]))
const unescape = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
const structure = { topics: 0, math: 0, glossaryLinks: 0 }
for (const c of manifest.chapters) {
  let structured = 0
  for (const t of c.topics) {
    const file = join(root, 'pages', c.id, `${t.id}.html`)
    if (!existsSync(file)) continue
    const html = readFileSync(file, 'utf8')
    const where = `pages/${c.id}/${t.id}.html`
    for (const m of html.matchAll(/<(span|div) class="math">([\s\S]*?)<\/\1>/g)) {
      structure.math++
      try {
        katex.renderToString(unescape(m[2]), { displayMode: m[1] === 'div', throwOnError: true })
      } catch (e) {
        err(where, `math does not parse: ${m[2].slice(0, 60)} (${e.message.split('\n')[0]})`)
      }
    }
    if (/class="[^"]*(?<![\w-])math(?![\w-])[^"]*"/.test(html.replace(/<(span|div) class="math">/g, ''))) err(where, 'write math as <span class="math"> or <div class="math"> with no other class')
    for (const m of html.matchAll(/<a\b[^>]*class="gl"[^>]*>/g)) {
      structure.glossaryLinks++
      const id = /href="#gl-([^"]+)"/.exec(m[0])?.[1]
      if (!id) err(where, `glossary link needs href="#gl-<id>": ${m[0]}`)
      else if (!glossary[id]) err(where, `glossary link to unknown term ${id}`)
    }
    const parts = [...html.matchAll(/<section class="tp tp-([a-z]+)"[^>]*>/g)]
    if (!parts.length) continue
    structured++
    structure.topics++
    const names = parts.map((m) => m[1])
    if (names.join() !== PARTS.join()) err(where, `topic parts must be ${PARTS.join(', ')} in that order (found ${names.join(', ')})`)
    const part = (name) => {
      const i = parts.findIndex((m) => m[1] === name)
      if (i < 0) return ''
      const from = parts[i].index
      const to = i + 1 < parts.length ? parts[i + 1].index : html.length
      return html.slice(from, to)
    }
    for (const m of parts) if (!/^<section class="tp tp-[a-z]+" id="[a-z0-9-]+">$/.test(m[0])) err(where, `write a part as <section class="tp tp-${m[1]}" id="${t.id}-${m[1]}">`)
    for (const name of PARTS) {
      const body = part(name)
      if (body && !new RegExp(`^<section[^>]*>\\s*<h3 data-n="[^"]+">`).test(body)) err(where, `the ${name} part starts with <h3 data-n="…">`)
    }
    if (!/class="math"/.test(part('math'))) err(where, 'the Math part needs at least one formula (class="math")')
    const code = part('code')
    const widgets = [...code.matchAll(/data-widget="(py-snippet|colab-guide)"(?:\s+data-props='([^']*)')?/g)]
    if (!widgets.length) err(where, 'the Code part needs a py-snippet or a colab-guide')
    for (const w of widgets.filter((x) => x[1] === 'py-snippet')) {
      const id = JSON.parse(w[2] || '{}').snippet
      if (!SNIPPET_IDS.has(id)) err(where, `unknown py-snippet ${id}`)
    }
    const slot = html.indexOf('data-slot="practice"')
    const src = parts.find((m) => m[1] === 'sources')?.index ?? -1
    const codeAt = parts.find((m) => m[1] === 'code')?.index ?? -1
    if (slot < 0 || !(slot > codeAt && slot < src)) err(where, 'the practice block goes between the Code and Primary sources parts')
    const links = [...part('sources').matchAll(/href="https?:\/\//g)].length
    if (links < 2) err(where, `Primary sources needs at least 2 links (found ${links})`)
  }
  if (structured && structured < c.topics.length) err(c.id, `${structured} of ${c.topics.length} topics use the topic structure; restructure a chapter all at once`)
}

if (errors.length) {
  console.error('Content errors:\n- ' + errors.join('\n- '))
  process.exit(1)
}
if (warnings.length) console.warn('Content warnings:\n- ' + warnings.join('\n- '))
writeFileSync(join(root, 'checks', 'summary.json'), JSON.stringify(summary, null, 1) + '\n')
console.log(`content ok · ${summary.totals.mcq} choose-the-answer · ${summary.totals.interview} interview questions · ${structure.topics} structured topics · ${structure.math} formulas · ${Object.keys(glossary).length} glossary terms`)
