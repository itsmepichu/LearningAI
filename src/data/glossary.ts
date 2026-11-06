/**
 * The course glossary: one short, plain definition per term, and the topic that teaches it. Content links a term as
 * `<a class="gl" href="#gl-<id>">term</a>`; hovering or focusing it shows the definition, and following it opens the
 * term on the glossary page. Loaded on first use, since most pages need only a few entries.
 */
export interface GlossaryEntry {
  term: string
  /** One or two plain sentences, at most about 45 words. */
  def: string
  /** The topic that teaches it, such as "c5-2". */
  topic: string
  /** Other names for the same thing, shown on the glossary page and found by its filter. */
  aliases?: string[]
}
export type Glossary = Record<string, GlossaryEntry>

let cache: Promise<Glossary> | null = null
export const loadGlossary = (): Promise<Glossary> => (cache ??= import('../content/glossary.json').then((m) => m.default as Glossary))

/** The glossary id in a term link's href, or undefined if the link is not a term. */
export const termId = (href: string | null): string | undefined => (href?.startsWith('#gl-') ? href.slice(4) : undefined)

/** Entries sorted by term, ignoring case and leading symbols. */
export const sortedEntries = (g: Glossary) =>
  Object.entries(g).sort(([, a], [, b]) => a.term.replace(/^[^A-Za-z0-9]+/, '').localeCompare(b.term.replace(/^[^A-Za-z0-9]+/, ''), 'en', { sensitivity: 'base' }))
