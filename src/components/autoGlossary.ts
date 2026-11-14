import type { Glossary } from '../data/glossary'

/** Terms whose plain-English sense is too common to mark by themselves: authors link these by hand when they mean the term. */
const COMMON_WORDS = new Set([
  'agent', 'baseline', 'fallback', 'checkpoint', 'ensemble', 'clustering', 'classification', 'corpus', 'momentum', 'handoff',
  'streaming', 'attention', 'transformer', 'router', 'compaction', 'lineage', 'abstention', 'workflow', 'grounding',
])
/** Where text is left alone: links, code, headings, figures, widgets, tables of sources and controls. */
const SKIP = 'a, code, pre, kbd, h1, h2, h3, h4, h5, h6, figure, figcaption, svg, button, input, select, textarea, label, summary, script, style, small, th, [data-widget], [data-slot], .tp-code, .tp-sources, .tag, .terms, .tools, .flow, .outcomes'
const MAX_LINKS = 10

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

interface Matcher { id: string; re: RegExp }

/** The words that mean an entry: its term without the bracketed part, the bracketed acronym, and its aliases. */
function namesOf(id: string, e: Glossary[string]): string[] {
  const names = new Set<string>()
  const bracket = /\(([^)]+)\)/.exec(e.term)
  names.add(e.term.replace(/\s*\([^)]*\)/g, '').trim())
  if (bracket && !bracket[1].includes(',')) names.add(bracket[1].trim())
  for (const a of e.aliases ?? []) names.add(a)
  return [...names].filter((n) => n.length >= 3 || /^[A-Z0-9]{2,}$/.test(n))
}

function matchers(g: Glossary, linked: Set<string>): Matcher[] {
  const out: Matcher[] = []
  for (const [id, e] of Object.entries(g)) {
    if (linked.has(id) || COMMON_WORDS.has(id)) continue
    for (const name of namesOf(id, e)) {
      // Acronyms and names with capitals inside match exactly; ordinary words match in any case.
      const exact = /[A-Z]/.test(name.slice(1)) || name === name.toUpperCase()
      out.push({ id, re: new RegExp(`(?<![\\w-])${escape(name)}(?:s|es)?(?![\\w-])`, exact ? '' : 'i') })
    }
  }
  // longest names first, so "Byte-pair encoding" wins over a shorter overlapping name
  return out.sort((a, b) => b.re.source.length - a.re.source.length)
}

/**
 * Marks the first mention of each glossary term in the body text of a topic with the same `a.gl` link authors write by hand,
 * so the definition card appears on hover or focus. Terms the author already linked are left alone, and so are the headings,
 * code, figures and widgets. At most MAX_LINKS terms are marked, in reading order, so the page stays calm.
 */
export function linkGlossary(root: HTMLElement, g: Glossary): number {
  const linked = new Set<string>()
  root.querySelectorAll<HTMLAnchorElement>('a.gl').forEach((a) => linked.add(a.getAttribute('href')?.slice(4) ?? ''))
  const ms = matchers(g, linked)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text
    if (t.data.trim().length > 2 && !t.parentElement?.closest(SKIP)) nodes.push(t)
  }
  let made = 0
  for (const node of nodes) {
    let current: Text | null = node
    while (current && made < MAX_LINKS) {
      let best: { at: number; len: number; id: string } | null = null
      for (const m of ms) {
        if (linked.has(m.id)) continue
        const hit = m.re.exec(current.data)
        if (hit && (!best || hit.index < best.at)) best = { at: hit.index, len: hit[0].length, id: m.id }
      }
      if (!best) break
      const rest: Text = current.splitText(best.at)
      const tail: Text = rest.splitText(best.len)
      const a = document.createElement('a')
      a.className = 'gl'
      a.href = `#gl-${best.id}`
      a.textContent = rest.data
      rest.replaceWith(a)
      linked.add(best.id)
      made++
      current = tail
    }
    if (made >= MAX_LINKS) break
  }
  return made
}
