import type { ProjectId } from './projects'

export type McqKind = 'concept' | 'calculation' | 'scenario'
export type Level = 'fundamentals' | 'applied' | 'system-design'
export interface Mcq {
  id: string
  q: string
  options: string[]
  /** Index of the right option, or several indices for "choose all that apply". */
  answer: number | number[]
  why: string
  /** Optional per-option explanation; "" for the right answer. */
  distractors?: string[]
  kind?: McqKind
}
export interface InterviewQ {
  id: string
  q: string
  level: Level
  covers: string[]
  followUp?: string
  project?: ProjectId
}
export interface Section { mcq?: Mcq[]; interview?: InterviewQ[] }
export type ChapterChecks = Record<string, Section>

export const LEVEL_LABEL: Record<Level, string> = { fundamentals: 'Fundamentals', applied: 'Applied', 'system-design': 'System design' }
export const KIND_LABEL: Record<McqKind, string> = { concept: 'Concept', calculation: 'Calculation', scenario: 'Scenario' }

export const isMulti = (q: Mcq) => Array.isArray(q.answer)
export const answerSet = (q: Mcq) => new Set(Array.isArray(q.answer) ? q.answer : [q.answer])
export function isCorrect(q: Mcq, given: number | number[] | undefined): boolean | undefined {
  if (given === undefined) return undefined
  const want = answerSet(q)
  const got = new Set(Array.isArray(given) ? given : [given])
  return want.size === got.size && [...want].every((a) => got.has(a))
}

const loaders = import.meta.glob(['../content/checks/*.json', '!../content/checks/summary.json', '!../content/checks/legacy-quiz-map.json'], {
  import: 'default',
}) as Record<string, () => Promise<ChapterChecks>>
const cache = new Map<string, Promise<ChapterChecks>>()
export function loadChecks(chapterId: string): Promise<ChapterChecks> {
  const fn = loaders[`../content/checks/${chapterId}.json`]
  if (!fn) return Promise.resolve({})
  if (!cache.has(chapterId)) cache.set(chapterId, fn())
  return cache.get(chapterId)!
}
