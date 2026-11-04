import manifest from '../content/manifest.json'
import idmap from '../content/idmap.json'

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
export interface QuizQ { q: string; options: string[]; answer: number; why: string }
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
  quiz: QuizQ[]
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
export const courseTopics = allTopics.filter((t) => t.chapter.kind === 'chapter')

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
  questions: chapters.reduce((a, c) => a + c.quiz.length, 0),
}

/** Lazy loaders for every HTML fragment, keyed by "<chapter>/<file>". */
const loaders = import.meta.glob('../content/pages/**/*.html', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>
export function loadPage(chapterId: string, file: string): Promise<string> {
  const fn = loaders[`../content/pages/${chapterId}/${file}.html`]
  return fn ? fn() : Promise.resolve('')
}

/** Suggested routes through the course, at chapter level. */
export const paths = [
  { id: 'foundations', title: 'Foundations first', who: 'New to ML', chapters: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'], blurb: 'Tokens, vectors, gradients, networks and transformers before any application work.' },
  { id: 'rag', title: 'RAG engineer', who: 'Search and knowledge', chapters: ['c5', 'c7', 'c8', 'c9', 'c10', 'c16', 'c17'], blurb: 'Retrieval, evaluation and permissions from one index to millions of documents.' },
  { id: 'agents', title: 'Agent engineer', who: 'Tools and workflows', chapters: ['c7', 'c8', 'c11', 'c12', 'c16', 'c17'], blurb: 'Tool calling, durable state, multi-agent patterns and the security they need.' },
  { id: 'platform', title: 'Platform and serving', who: 'Infra and SRE', chapters: ['c5', 'c6', 'c14', 'c15', 'c17', 'c18'], blurb: 'GPU memory, batching, capacity, reliability, observability and release gates.' },
  { id: 'governance', title: 'Security and governance', who: 'Risk and compliance', chapters: ['c1', 'c8', 'c16', 'c17', 'c18'], blurb: 'Threats, isolation, audit, evaluation evidence and controlled rollout.' },
]
