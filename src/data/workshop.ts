import { getChapter, getTopic, type Chapter, type Topic } from './course'
import { DEFAULT_PROJECT, getProject, isProjectId, practiceChapterIds, projects, type ChapterPractice, type PracticeNote, type ProjectId, type TopicPractice } from './projects'

/**
 * The example project a topic's lesson uses: the topic's `primary` in the manifest, else the default project.
 * A lesson shows one project. The workshop is where the reader picks one of the four.
 */
export function primaryProject(topicId: string | undefined): ProjectId {
  const p = getTopic(topicId)?.primary
  return isProjectId(p) ? p : DEFAULT_PROJECT
}

/**
 * The topic whose lesson a path shows, or undefined for any other page. Lessons use the topic's primary project;
 * the capstone is not a lesson in this sense, because its topics follow the reader's own project choice.
 */
export function lessonTopicAt(pathname: string): Topic | undefined {
  const [chapterId, topicId, extra] = pathname.split('/').filter(Boolean)
  if (!chapterId || !topicId || extra || topicId === 'check' || topicId === 'workshop') return undefined
  const ch = getChapter(chapterId)
  if (!ch || ch.kind === 'capstone') return undefined
  return ch.topics.find((t) => t.id === topicId)
}

const withPractice = new Set(practiceChapterIds())
/** Every chapter and the capstone has a workshop, because each has practice notes. The appendices have neither. */
export const hasWorkshop = (chapterId: string) => withPractice.has(chapterId)

export const workshopPath = (chapterId: string, topicId?: string) => `/${chapterId}/workshop${topicId ? '#' + topicId : ''}`

/** Which project to offer when the chosen one has little to try, or no note, in a topic. Best fit first, then good. */
export function betterProject(tp: TopicPractice | undefined, chosen: ProjectId, topicId: string): ProjectId | undefined {
  if (!tp) return undefined
  const order = [primaryProject(topicId), ...projects.map((p) => p.id)]
  const has = (id: ProjectId, fit: string) => id !== chosen && tp[id]?.fit === fit && !!tp[id]?.tryIt
  for (const fit of ['best', 'good']) {
    const hit = order.find((id) => has(id, fit))
    if (hit) return hit
  }
  return undefined
}

export interface WorkshopTask {
  topic: Topic
  /** Whose note is shown as the task. */
  project: ProjectId
  note: PracticeNote
  /** Why it is not the chosen project's own note: it fits poorly, or has not been written. */
  instead?: 'limited' | 'missing'
  /** The chosen project's own note, when `instead` is 'limited'. */
  own?: PracticeNote
  /** The route that opens the topic's first interactive figure with this project's data. */
  figure: string
}

const figureRoute = (ch: Chapter, t: Topic, project: ProjectId) =>
  `/${ch.id}/${t.id}?project=${project}${t.live?.[0] ? '#' + t.live[0] : ''}`

/** The tasks of a chapter's workshop for the chosen project, in topic order. A topic with no note for any project is left out. */
export function workshopTasks(ch: Chapter, practice: ChapterPractice | null, chosen: ProjectId): WorkshopTask[] {
  if (!practice) return []
  const out: WorkshopTask[] = []
  for (const t of ch.topics) {
    const tp = practice[t.id]
    if (!tp) continue
    const own = tp[chosen]
    const usable = own && own.fit !== 'limited' && own.tryIt
    if (usable) {
      out.push({ topic: t, project: chosen, note: own, figure: figureRoute(ch, t, chosen) })
      continue
    }
    const alt = betterProject(tp, chosen, t.id) ?? (tp[primaryProject(t.id)] ? primaryProject(t.id) : undefined)
    if (alt && tp[alt]) {
      out.push({ topic: t, project: alt, note: tp[alt]!, instead: own ? 'limited' : 'missing', own, figure: figureRoute(ch, t, alt) })
    } else if (own) {
      out.push({ topic: t, project: chosen, note: own, figure: figureRoute(ch, t, chosen) })
    }
  }
  return out
}

/** The dataset files of a project that a note's text names, for the "Open in the data explorer" link. */
export function datasetFilesIn(html: string | undefined, project: ProjectId): string[] {
  const p = getProject(project)
  if (!p || !html) return []
  return p.datasets.map((d) => d.file).filter((f) => html.includes(f))
}
