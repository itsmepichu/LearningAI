import evidenceData from '../content/generated/evidence.json'
import { getChapter, parts } from './course'

/** One thing to keep and show: a chapter lab's deliverable or a capstone milestone. */
export interface EvidenceItem {
  /** A chapter id (`c5`) for a lab item, `ms0` to `ms8` for a milestone. */
  id: string
  kind: 'lab' | 'milestone'
  title: string
  /** What to build (milestones only). */
  build?: string
  keep: string
  pass: string
  /** Where the item is done. */
  to: string
}

interface Generated {
  labs: { chapter: string; num: string; title: string; keep: string; pass: string }[]
  milestones: { id: string; n: number; title: string; build: string; keep: string; pass: string }[]
}
const data = evidenceData as Generated

export const labItems: EvidenceItem[] = data.labs.map((l) => ({
  id: l.chapter,
  kind: 'lab',
  title: `Chapter ${l.num} lab · ${l.title}`,
  keep: l.keep,
  pass: l.pass,
  to: `/${l.chapter}/workshop#lab`,
}))

/** Milestone 0 exists on the Evidence page only: the capstone's eight milestones keep their numbers. */
const milestoneZero: EvidenceItem = {
  id: 'ms0',
  kind: 'milestone',
  title: 'Milestone 0 · The tiny language model',
  build: 'Run the tiny language model from chapter 1 and finish the six Part I labs.',
  keep: 'The three loss numbers from the chapter 1 run, and the six Part I lab deliverables listed below.',
  pass: 'The bigram loss is below both baselines, and each of the six Part I labs meets its own pass condition.',
  to: '/c1/workshop#lab',
}

export const milestoneItems: EvidenceItem[] = [
  milestoneZero,
  ...data.milestones.map((m) => ({
    id: m.id,
    kind: 'milestone' as const,
    title: `Milestone ${m.n} · ${m.title}`,
    build: m.build,
    keep: m.keep,
    pass: m.pass,
    to: '/capstone/workshop',
  })),
]

/**
 * The milestones each part ends with. Each milestone sits in the part that has taught what it needs:
 * 1–3 retrieval and answering (Part II), 4 durable actions (Part III), 5–8 adaptation, operations, security and release (Part IV).
 */
export const PART_MILESTONES: Record<string, string[]> = {
  p1: ['ms0'],
  p2: ['ms1', 'ms2', 'ms3'],
  p3: ['ms4'],
  p4: ['ms5', 'ms6', 'ms7', 'ms8'],
  p5: [],
}

export const milestonesOf = (partId: string) => (PART_MILESTONES[partId] ?? []).map((id) => milestoneItems.find((m) => m.id === id)).filter((m): m is EvidenceItem => !!m)
export const labItemsOf = (partId: string) => {
  const ids = parts.find((p) => p.id === partId)?.chapters ?? []
  return labItems.filter((l) => ids.includes(l.id) && getChapter(l.id))
}
/** The part whose last chapter this is, if any: the page that shows the Part checkpoint. */
export const partEndingAt = (chapterId: string) => parts.find((p) => p.id !== 'res' && p.chapters[p.chapters.length - 1] === chapterId)
