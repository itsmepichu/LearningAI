import manifest from '../content/manifest.json'
import idmap from '../content/idmap.json'
import checkSummary from '../content/checks/summary.json'

export type Tag = 'cpu' | 'real' | 'sim' | 'gpu'
export interface Topic {
  id: string
  tn: string
  title: string
  tags: Tag[]
  figures: number
  interactive: number
  words: number
}
export interface Chapter {
  id: string
  num: string
  title: string
  lede: string
  kind: 'chapter' | 'capstone' | 'appendix'
  part: string
  www: { what?: string; why?: string; where?: string }
  topics: Topic[]
  hasIntro: boolean
  hasOutro: boolean
  hasLab: boolean
}
export interface Part { id: string; label: string; title: string; chapters: string[] }

export const parts = manifest.parts as Part[]
export const chapters = manifest.chapters as Chapter[]
export const courseChapters = chapters.filter((c) => c.kind === 'chapter')

const chapterById = new Map(chapters.map((c) => [c.id, c]))
export const getChapter = (id?: string) => (id ? chapterById.get(id) : undefined)

export interface TopicRef extends Topic { chapter: Chapter; index: number }
export const allTopics: TopicRef[] = chapters.flatMap((chapter) => chapter.topics.map((t) => ({ ...t, chapter, index: 0 })))
allTopics.forEach((t, i) => (t.index = i))
const topicById = new Map(allTopics.map((t) => [t.id, t]))
export const getTopic = (id?: string) => (id ? topicById.get(id) : undefined)
/** What progress counts: the chapters and the capstone, not the appendices. */
export const progressChapters = chapters.filter((c) => c.kind !== 'appendix')
export const courseTopics = allTopics.filter((t) => t.chapter.kind !== 'appendix')

export const topicPath = (t: { id: string; chapter: Chapter } | TopicRef) => `/${t.chapter.id}/${t.id}`
export const chapterPath = (c: Chapter) => `/${c.id}`

/** Resolve a legacy in-page anchor ("#c9-3", "#bmQ") to an app route. */
export const resolveAnchor = (id: string): string | undefined => (idmap as Record<string, string>)[id]

export const minutes = (t: Topic) => Math.max(3, Math.round(t.words / 200 + t.figures * 1.5))

export const partOf = (c: Chapter) => parts.find((p) => p.id === c.part)

export const totals = {
  chapters: courseChapters.length,
  topics: courseTopics.length,
  figures: allTopics.reduce((a, t) => a + t.figures, 0),
  interactive: allTopics.reduce((a, t) => a + t.interactive, 0),
  mcq: checkSummary.totals.mcq,
  interview: checkSummary.totals.interview,
}

export interface SectionCount { mcq: number; interview: number }
const summaryChapters = checkSummary.chapters as Record<string, SectionCount & { sections: Record<string, SectionCount> }>
export const chapterCheckCount = (chapterId: string): SectionCount => summaryChapters[chapterId] ?? { mcq: 0, interview: 0 }
export const sectionCheckCount = (chapterId: string, topicId: string): SectionCount =>
  summaryChapters[chapterId]?.sections[topicId] ?? { mcq: 0, interview: 0 }
export const chaptersWithChecks = () => chapters.filter((c) => summaryChapters[c.id])

/** Lazy loaders for every HTML fragment, keyed by "<chapter>/<file>". */
const loaders = import.meta.glob('../content/pages/**/*.html', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>
export function loadPage(chapterId: string, file: string): Promise<string> {
  const fn = loaders[`../content/pages/${chapterId}/${file}.html`]
  return fn ? fn() : Promise.resolve('')
}

