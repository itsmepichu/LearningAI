import data from '../content/projects.json'

export type ProjectId = 'harbor' | 'store' | 'bank' | 'travel'
export type Fit = 'best' | 'good' | 'limited'
export interface DatasetFile { file: string; what: string; notes: string }
export interface Project {
  id: ProjectId
  label: string
  kind: string
  company: string
  assistant: string
  about: string
  scale: string
  teaches: string
  accent: string
  icon: string
  datasets: DatasetFile[]
}
export interface PracticeNote {
  practice: string
  failure: string
  tryIt?: string
  fit?: Fit
  /** Why this project suits the topic, shown when another project fits poorly. */
  fitNote?: string
}
export type TopicPractice = Partial<Record<ProjectId, PracticeNote>>
export interface LabVariant { scenario: string }
export type ChapterPractice = Record<string, TopicPractice> & { _lab?: Partial<Record<ProjectId, LabVariant>> }

export const projects = data.projects as Project[]
export const DEFAULT_PROJECT = data.default as ProjectId
const byId = new Map(projects.map((p) => [p.id, p]))
export const getProject = (id: string | null | undefined): Project | undefined => (id ? byId.get(id as ProjectId) : undefined)
export const isProjectId = (id: string | null | undefined): id is ProjectId => !!id && byId.has(id as ProjectId)

/** Replace {company} and {assistant} tokens so names live only in projects.json. */
export function fill(html: string | undefined, p: Project): string {
  return (html ?? '').replace(/\{company\}/g, p.company).replace(/\{assistant\}/g, p.assistant)
}

export const datasetUrl = (p: Project, file: string) => `${import.meta.env.BASE_URL}datasets/${p.id}/${file}`

const loaders = import.meta.glob('../content/practice/*.json', { import: 'default' }) as Record<string, () => Promise<ChapterPractice>>
const cache = new Map<string, Promise<ChapterPractice>>()
export function loadPractice(chapterId: string): Promise<ChapterPractice> {
  const fn = loaders[`../content/practice/${chapterId}.json`]
  if (!fn) return Promise.resolve({} as ChapterPractice)
  if (!cache.has(chapterId)) cache.set(chapterId, fn())
  return cache.get(chapterId)!
}
export const practiceChapterIds = () => Object.keys(loaders).map((k) => k.replace(/^.*\/(.*)\.json$/, '$1'))
