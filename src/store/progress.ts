import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/** Learner state. Stored only in this browser (localStorage). */
interface ProgressState {
  studied: Record<string, true>
  quiz: Record<string, number>
  last?: string
  setStudied: (id: string, on: boolean) => void
  setMany: (ids: string[], on: boolean) => void
  answer: (qid: string, choice: number) => void
  resetQuiz: (prefix: string) => void
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
      quiz: {},
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
      answer: (qid, choice) => set((s) => ({ quiz: { ...s.quiz, [qid]: choice } })),
      resetQuiz: (prefix) =>
        set((s) => ({ quiz: Object.fromEntries(Object.entries(s.quiz).filter(([k]) => !k.startsWith(prefix))) })),
      visit: (path) => set({ last: path }),
      reset: () => set({ studied: {}, quiz: {}, last: undefined }),
    }),
    { name: 'lai-progress-v1', storage: safeStorage, version: 1 },
  ),
)
