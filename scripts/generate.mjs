// Writes the files the app derives from authored content into src/content/generated/ (not committed):
//   topic-stats.json   figures, interactive figures and words per topic, counted from the topic HTML
//   idmap.json         element id -> route, from the ids in the pages, plus src/content/idmap.extra.json
//   search.json        plain text per topic, for the search dialog
//   check-summary.json question counts per chapter and section, from the checks files
// Runs automatically before `npm run dev`, `build` and `test`, and after `npm install`. It generates; it checks nothing.
import { join } from 'node:path'
import { CONTENT, existsSync, manifest, pagePath, readJson, readText, stripTags, writeGenerated } from './lib/content.mjs'

const m = manifest()

// ---- topic-stats.json
// figures = <figure> elements. interactive = data-widget embeds, plus legacy figures that have no data-widget: a figure with the
// class `live` or `flow`, or one that holds an input, button or select (the old importer counted the same blocks).
// A snippet is a figure with a widget, so it counts as both; a walkthrough sits outside a figure, so it counts as interactive only.
// words = text outside <svg>, with the tags stripped. live = ids of the interactive figures.
export function topicStats(html) {
  const figures = (html.match(/<figure\b/g) ?? []).length
  const widgets = (html.match(/<[a-zA-Z][^>]*\sdata-widget="/g) ?? []).length
  let legacy = 0
  for (const f of html.matchAll(/<figure\b[^>]*\sclass="([^"]*)"[^>]*>([\s\S]*?)<\/figure>/g)) {
    if (/\sdata-widget="/.test(f[2])) continue
    const cls = f[1].split(/\s+/)
    if (cls.includes('live') || cls.includes('flow') || /<(input|button|select)\b/.test(f[2])) legacy++
  }
  const words = stripTags(html.replace(/<svg[\s\S]*?<\/svg>/g, ' ')).split(' ').filter(Boolean).length
  // live = ids of the interactive figures, in page order: a `live` figure or a walkthrough that holds a widget, not a Colab guide.
  const live = []
  for (const f of html.matchAll(/<(figure|div)\b([^>]*)>/g)) {
    const id = /\sid="([^"]+)"/.exec(f[2])?.[1]
    const cls = (/\sclass="([^"]*)"/.exec(f[2])?.[1] ?? '').split(/\s+/)
    if (id && !cls.includes('colab') && ((f[1] === 'figure' && cls.includes('live')) || cls.includes('walkthru'))) live.push(id)
  }
  return { figures, interactive: widgets + legacy, words, live }
}

const stats = {}
const search = []
for (const c of m.chapters) {
  for (const t of c.topics) {
    const html = readText(pagePath(c.id, t.id))
    stats[t.id] = topicStats(html)
    search.push({ id: t.id, ch: c.id, tn: t.tn, title: t.short ?? t.title, text: (t.short ? t.title + '. ' : '') + stripTags(html) })
  }
}
writeGenerated('topic-stats.json', stats)
writeGenerated('search.json', search)

// ---- idmap.json
// A topic id maps to its page, a chapter id to the chapter, and every other element id in a topic page to the page and the anchor.
// A chapter's lab and chapter check are `lab-<chapter>` and `quiz-<chapter>`. The first page to use an id wins. The guide's ids map to /guide and the start page's to /start. Entries that cannot be derived live in idmap.extra.json.
const idmap = {}
const add = (id, route) => { if (!(id in idmap)) idmap[id] = route }
const idsOf = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1])
const how = join(CONTENT, 'pages', 'home', 'how.html')
if (existsSync(how)) {
  for (const id of idsOf(readText(how))) add(id, '/guide#' + id)
  add('how', '/guide')
}
const start = join(CONTENT, 'pages', 'home', 'start.html')
if (existsSync(start)) {
  for (const id of idsOf(readText(start))) add(id, '/start#' + id)
  add('start', '/start')
}
for (const c of m.chapters) {
  for (const t of c.topics) {
    const route = `/${c.id}/${t.id}`
    add(t.id, route)
    for (const id of idsOf(readText(pagePath(c.id, t.id)))) add(id, route + '#' + id)
  }
  add(c.id, '/' + c.id)
  if (c.hasLab) add('lab-' + c.id, `/${c.id}/workshop#lab`)
  add('quiz-' + c.id, `/${c.id}/check`)
}
const extraFile = join(CONTENT, 'idmap.extra.json')
const extra = existsSync(extraFile) ? readJson(extraFile) : {}
writeGenerated('idmap.json', { ...idmap, ...extra })

// ---- check-summary.json (question counts)
const summary = { totals: { mcq: 0, interview: 0, core: 0 }, chapters: {} }
for (const c of m.chapters) {
  const file = join(CONTENT, 'checks', `${c.id}.json`)
  if (!existsSync(file)) continue
  const ch = { mcq: 0, interview: 0, core: 0, sections: {} }
  for (const [tid, sec] of Object.entries(readJson(file))) {
    const s = { mcq: (sec.mcq ?? []).length, interview: (sec.interview ?? []).length, core: (sec.mcq ?? []).filter((q) => q.tier === 'core').length }
    ch.sections[tid] = s
    ch.mcq += s.mcq
    ch.interview += s.interview
    ch.core += s.core
  }
  summary.chapters[c.id] = ch
  summary.totals.mcq += ch.mcq
  summary.totals.interview += ch.interview
  summary.totals.core += ch.core
}
writeGenerated('check-summary.json', summary, 1)

console.log(`generated · ${search.length} topics · ${Object.keys(idmap).length + Object.keys(extra).length} link targets · ${summary.totals.mcq} + ${summary.totals.interview} questions`)
