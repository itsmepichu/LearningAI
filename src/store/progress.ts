import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import legacyQuizMap from '../content/checks/legacy-quiz-map.json'
import { DEFAULT_PROJECT, type ProjectId } from '../data/projects'
import { newCard, review, type GradeName, type SavedCard } from '../data/flashcards'

export type Rating = 'missed' | 'partly' | 'covered'
export type Answer = number | number[]

/** Learner state. Stored only in this browser (localStorage). */
interface ProgressState {
  studied: Record<string, true>
  /** Choose-the-answer answers, keyed by stable question id. */
  answers: Record<string, Answer>
  /** Whether each saved answer was correct (so totals need no question files). */
  results: Record<string, boolean>
  /** Interview self-ratings, keyed by stable question id. */
  ratings: Record<string, Rating>
  /** Flashcards, keyed by question id. A choose-the-answer question answered wrongly joins the deck by itself. */
  cards: Record<string, SavedCard>
  project: ProjectId
  last?: string
  setStudied: (id: string, on: boolean) => void
  setMany: (ids: string[], on: boolean) => void
  answer: (qid: string, a: Answer, correct: boolean) => void
  clearAnswers: (qids: string[]) => void
  rate: (qid: string, r: Rating | undefined) => void
  addCard: (qid: string) => void
  removeCard: (qid: string) => void
  reviewCard: (qid: string, grade: GradeName) => void
  setProject: (p: ProjectId) => void
  visit: (path: string) => void
  reset: () => void
}

const safeStorage = createJSONStorage(() => {
  try {
    const k = '__lai_probe__'
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return localStorage
  } catch {
    const mem = new Map<string, string>()
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) }
  }
})

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      studied: {},
      answers: {},
      results: {},
      ratings: {},
      cards: {},
      project: DEFAULT_PROJECT,
      setStudied: (id, on) =>
        set((s) => {
          const studied = { ...s.studied }
          if (on) studied[id] = true
          else delete studied[id]
          return { studied }
        }),
      setMany: (ids, on) =>
        set((s) => {
          const studied = { ...s.studied }
          ids.forEach((id) => (on ? (studied[id] = true) : delete studied[id]))
          return { studied }
        }),
      answer: (qid, a, correct) =>
        set((s) => ({
          answers: { ...s.answers, [qid]: a },
          results: { ...s.results, [qid]: correct },
          ...(!correct && !s.cards[qid] ? { cards: { ...s.cards, [qid]: newCard(new Date()) } } : {}),
        })),
      clearAnswers: (qids) =>
        set((s) => {
          const answers = { ...s.answers }
          const results = { ...s.results }
          qids.forEach((q) => {
            delete answers[q]
            delete results[q]
          })
          return { answers, results }
        }),
      rate: (qid, r) =>
        set((s) => {
          const ratings = { ...s.ratings }
          if (r) ratings[qid] = r
          else delete ratings[qid]
          // An interview question you missed joins the flashcard deck, like a wrong answer does.
          if (r === 'missed' && !s.cards[qid]) return { ratings, cards: { ...s.cards, [qid]: newCard(new Date()) } }
          return { ratings }
        }),
      addCard: (qid) => set((s) => (s.cards[qid] ? {} : { cards: { ...s.cards, [qid]: newCard(new Date()) } })),
      removeCard: (qid) =>
        set((s) => {
          const cards = { ...s.cards }
          delete cards[qid]
          return { cards }
        }),
      reviewCard: (qid, grade) => set((s) => (s.cards[qid] ? { cards: { ...s.cards, [qid]: review(s.cards[qid], grade, new Date()) } } : {})),
      setProject: (project) => set({ project }),
      visit: (path) => set({ last: path }),
      reset: () => set({ studied: {}, answers: {}, results: {}, ratings: {}, cards: {}, last: undefined }),
    }),
    {
      name: 'lai-progress-v1',
      storage: safeStorage,
      version: 3,
      // v1 stored chapter quiz answers as quiz["c5:0"]; v2 keys answers by question id; v3 adds flashcards.
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Record<string, unknown>
        if (version < 2) {
          const quiz = (s.quiz ?? {}) as Record<string, number>
          const map = legacyQuizMap as Record<string, { id: string; answer: number }>
          const answers: Record<string, Answer> = {}
          const results: Record<string, boolean> = {}
          for (const [k, v] of Object.entries(quiz)) {
            const m = map[k]
            if (!m) continue
            answers[m.id] = v
            results[m.id] = v === m.answer
          }
          delete s.quiz
          return { ...s, answers, results, ratings: {}, cards: {}, project: DEFAULT_PROJECT } as unknown as ProgressState
        }
        if (version < 3) {
          // Questions already answered wrongly start the deck, due now.
          const results = (s.results ?? {}) as Record<string, boolean>
          const now = new Date()
          const cards = Object.fromEntries(Object.entries(results).filter(([, ok]) => !ok).map(([id]) => [id, newCard(now)]))
          return { ...s, cards } as unknown as ProgressState
        }
        return s as unknown as ProgressState
      },
    },
  ),
)
