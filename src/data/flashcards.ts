/**
 * Flashcards with spaced repetition. Each card is a chapter-check question, keyed by its stable id; FSRS (ts-fsrs)
 * schedules when it comes back. This module is pure, so a test can step a card through reviews at fixed times.
 * Cards are stored as JSON, so dates are kept as ISO strings.
 */
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs'

export type GradeName = 'again' | 'hard' | 'good' | 'easy'
export const GRADES: GradeName[] = ['again', 'hard', 'good', 'easy']
const GRADE: Record<GradeName, Grade> = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy }

/** A card as it is saved: ts-fsrs's card with dates as ISO strings, plus when it joined the deck. */
export interface SavedCard {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: State
  last_review?: string
  added: string
}

// Fuzz spreads due dates randomly; it is off so a card's schedule depends only on its reviews.
const scheduler = fsrs({ enable_fuzz: false })

function toSaved(c: Card, added: string): SavedCard {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    ...(c.last_review ? { last_review: c.last_review.toISOString() } : {}),
    added,
  }
}

function fromSaved(s: SavedCard): Card {
  return { ...s, due: new Date(s.due), last_review: s.last_review ? new Date(s.last_review) : undefined } as Card
}

/** A new card, due at once. */
export const newCard = (now: Date): SavedCard => toSaved(createEmptyCard(now), now.toISOString())

/** The card after a review graded `grade` at `now`. */
export function review(card: SavedCard, grade: GradeName, now: Date): SavedCard {
  return toSaved(scheduler.next(fromSaved(card), now, GRADE[grade]).card, card.added)
}

/** When the card would next be due for each grade, for the labels on the grade buttons. */
export function preview(card: SavedCard, now: Date): Record<GradeName, Date> {
  const r = scheduler.repeat(fromSaved(card), now)
  return { again: r[Rating.Again].card.due, hard: r[Rating.Hard].card.due, good: r[Rating.Good].card.due, easy: r[Rating.Easy].card.due }
}

/** Ids of the cards due at `now`, the most overdue first. */
export function dueIds(cards: Record<string, SavedCard>, now: Date): string[] {
  const t = now.getTime()
  return Object.entries(cards)
    .filter(([, c]) => Date.parse(c.due) <= t)
    .sort(([, a], [, b]) => Date.parse(a.due) - Date.parse(b.due))
    .map(([id]) => id)
}

/** The next time any card falls due, or undefined for an empty deck. */
export function nextDue(cards: Record<string, SavedCard>): Date | undefined {
  const ts = Object.values(cards).map((c) => Date.parse(c.due))
  return ts.length ? new Date(Math.min(...ts)) : undefined
}

/** The chapter a question id belongs to: "c10-2-m03" → "c10". */
export const chapterOf = (qid: string) => qid.slice(0, qid.indexOf('-'))

/** A short label for a wait, such as "10 min", "3 h", "4 days" or "2 mo". */
export function formatWait(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h`
  const d = Math.round(h / 24)
  if (d < 31) return `${d} ${d === 1 ? 'day' : 'days'}`
  const mo = Math.round(d / 30)
  if (mo < 12) return `${mo} mo`
  return `${(d / 365).toFixed(1)} y`
}
