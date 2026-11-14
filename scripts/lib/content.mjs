// Shared helpers for the Node scripts that read and write course content.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const CONTENT = join(ROOT, 'src', 'content')
export const GENERATED = join(CONTENT, 'generated')
export const PROJECTS = ['harbor', 'store', 'bank', 'travel']

export const readText = (path) => readFileSync(path, 'utf8')
export const readJson = (path) => JSON.parse(readText(path))
export { existsSync, readdirSync }

/**
 * Write JSON the way the Python authoring tools did: one space of indent, non-ASCII characters kept,
 * and no trailing newline unless the file already had one (so an untouched file produces no diff).
 */
export function writeJson(path, data, { indent = 1, newline } = {}) {
  const had = existsSync(path) ? /\n$/.test(readText(path)) : false
  const eol = newline ?? had
  writeFileSync(path, JSON.stringify(data, null, indent) + (eol ? '\n' : ''))
}

/** Write a generated file: compact JSON and a trailing newline. */
export function writeGenerated(name, data, indent) {
  mkdirSync(GENERATED, { recursive: true })
  writeFileSync(join(GENERATED, name), JSON.stringify(data, null, indent) + '\n')
}

export const manifest = () => readJson(join(CONTENT, 'manifest.json'))
export const pagePath = (chapter, name) => join(CONTENT, 'pages', chapter, `${name}.html`)

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', middot: '·', times: '×', rarr: '→', larr: '←' }
export const unescapeHtml = (s) =>
  s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
    return NAMED[e] ?? m
  })

/** Plain text of an HTML fragment: scripts and styles dropped, tags removed, entities decoded, spaces collapsed. */
export function stripTags(html) {
  const s = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')
  return unescapeHtml(s).replace(/\s+/g, ' ').trim()
}

/** Every topic with its chapter, in manifest order. */
export function allTopics(m = manifest()) {
  return m.chapters.flatMap((c) => c.topics.map((t) => ({ ...t, chapter: c })))
}
