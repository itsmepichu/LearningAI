// Scaffolds a topic: node scripts/new-topic.mjs <chapterId> <topicId> "<Title>" [--primary=<projectId>]   (npm run new:topic -- c9 c9-9 "Title")
// Creates the topic HTML (five parts and the practice slot), its manifest entry, one note for the topic's primary project
// (Harbor unless --primary is given; the manifest records a non-default primary), a chapter-check
// section and a snippet. Counts, link targets and search text are generated, so nothing else needs editing.
// Every stub carries a visible TODO. The chapter-check section starts empty, so no unfinished question is published.
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONTENT, PROJECTS, ROOT, manifest, pagePath, readJson, writeJson } from './lib/content.mjs'

const args = process.argv.slice(2)
const primaryArg = args.find((a) => a.startsWith('--primary='))?.slice('--primary='.length)
const [chapterId, topicId, ...rest] = args.filter((a) => !a.startsWith('--primary='))
const title = rest.join(' ').trim()
const fail = (msg) => {
  console.error(msg)
  process.exit(1)
}
if (!chapterId || !topicId || !title) fail('Usage: npm run new:topic -- <chapterId> <topicId> "<Title>" [--primary=<projectId>]   (for example: c9 c9-9 "Rerankers")')
const defaultProject = readJson(join(CONTENT, 'projects.json')).default
const primary = primaryArg ?? defaultProject
if (!PROJECTS.includes(primary)) fail(`Unknown project ${primary}. Use one of: ${PROJECTS.join(', ')}`)

const m = manifest()
const chapter = m.chapters.find((c) => c.id === chapterId)
if (!chapter) fail(`Unknown chapter ${chapterId}`)
if (!topicId.startsWith(chapterId + '-')) fail(`The topic id must start with "${chapterId}-"`)
if (m.chapters.some((c) => c.topics.some((t) => t.id === topicId))) fail(`Topic ${topicId} already exists`)
if (existsSync(pagePath(chapterId, topicId))) fail(`${pagePath(chapterId, topicId)} already exists`)

const touched = []
const last = chapter.topics.at(-1)
const tn = last ? last.tn.replace(/(\d+)$/, (n) => String(Number(n) + 1)) : `${parseInt(chapter.num, 10) || chapter.num}.1`

// snippet module for this chapter, if it has one (chapters c1–c23 and the capstone)
const snippetFile = /^c\d+$/.test(chapterId) ? `${chapterId}.ts` : chapterId === 'capstone' ? 'capstone.ts' : null
const snippetPath = snippetFile && join(ROOT, 'src', 'widgets', 'py-snippet', snippetFile)

// 1. HTML
const embed = snippetPath
  ? `<figure class="fig live" id="snip-${topicId}"><div class="stage"><div data-widget="py-snippet" data-props='{"snippet":"${topicId}"}'></div></div>
<figcaption><b>TODO: say what this program shows.</b> TODO: label any illustrative numbers.</figcaption></figure>`
  : '<p>TODO: this chapter has no snippet module; add the code or the Colab guide here.</p>'
const html = `<section class="tp tp-intuition" id="${topicId}-intuition">
<h3 data-n="1">Intuition</h3>
<p>TODO: plain words and an analogy, no formulas.</p>
</section>

<section class="tp tp-mechanism" id="${topicId}-mechanism">
<h3 data-n="2">Mechanism</h3>
<p>TODO: how it works, with the topic's figures.</p>
</section>

<section class="tp tp-math" id="${topicId}-math">
<h3 data-n="3">The numbers</h3>
<p>TODO: plain words and a small worked example with real numbers, such as 240 ÷ 100 = 2.4. No formulas.</p>
</section>

<section class="tp tp-code" id="${topicId}-code">
<h3 data-n="4">Code</h3>
<p>TODO: one line on what the program does and what to change.</p>
${embed}
</section>

<div data-slot="practice"></div>

<section class="tp tp-sources" id="${topicId}-sources">
<h3 data-n="5">Primary sources</h3>
<ol>
<li><a href="https://example.com/TODO">TODO: a paper or official documentation</a> <small>TODO: what it is for.</small></li>
<li><a href="https://example.com/TODO">TODO: a second source</a> <small>TODO: what it is for.</small></li>
</ol>
</section>
`
writeFileSync(pagePath(chapterId, topicId), html)
touched.push(`src/content/pages/${chapterId}/${topicId}.html`)

// 2. manifest entry
chapter.topics.push({ id: topicId, tn, title, tags: [], ...(primary === defaultProject ? {} : { primary }), outcomes: ['TODO: first thing the reader can do afterwards', 'TODO: second thing the reader can do afterwards'] })
writeJson(join(CONTENT, 'manifest.json'), m)
touched.push('src/content/manifest.json')

// 3. one note, for the topic's primary project. Notes for the other projects are optional (see src/content/CLAUDE.md).
const practicePath = join(CONTENT, 'practice', `${chapterId}.json`)
const practice = existsSync(practicePath) ? readJson(practicePath) : {}
practice[topicId] = Object.fromEntries(
  [primary].map((p) => [p, { practice: 'TODO: how the idea applies to {company}, 25–45 words.', failure: 'TODO: the failure to avoid, 12–25 words.', tryIt: 'TODO: exactly what to change in the figure or run on a laptop, 25–45 words.', fit: 'good', fitNote: 'TODO: why this project suits the topic' }]),
)
writeJson(practicePath, practice)
touched.push(`src/content/practice/${chapterId}.json`)

// 4. an empty chapter-check section
const checksPath = join(CONTENT, 'checks', `${chapterId}.json`)
const checks = existsSync(checksPath) ? readJson(checksPath) : {}
checks[topicId] = { mcq: [], interview: [] }
writeJson(checksPath, checks)
touched.push(`src/content/checks/${chapterId}.json`)

// 5. a snippet
if (snippetPath) {
  const src = readFileSync(snippetPath, 'utf8')
  const end = src.lastIndexOf('} satisfies Record<string, Snippet>')
  if (end < 0) fail(`Could not find the end of the snippet table in ${snippetFile}`)
  const stub = `  '${topicId}': {
    title: 'TODO: snippet title',
    brief: 'TODO: what the program does, in a sentence.',
    proves: 'TODO: what the output does and does not show.',
    neutral: true,
    build: async () => ({ code: 'print("TODO: write the snippet for ${topicId}")', files: {}, sources: [] }),
  },
`
  writeFileSync(snippetPath, src.slice(0, end) + stub + src.slice(end))
  touched.push(`src/widgets/py-snippet/${snippetFile}`)
}

console.log(`Created ${topicId} (${tn}) in ${chapterId}. Files touched:\n  ${touched.join('\n  ')}\nSearch for TODO to find what is left to write. Run \`npm run generate\` (or \`npm run dev\`) to update counts, link targets and search.`)
