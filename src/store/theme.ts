import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark'
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined

function stored(): ThemeMode | undefined {
  try {
    const t = localStorage.getItem('lai-theme')
    return t === 'light' || t === 'dark' ? t : undefined
  } catch {
    return undefined
  }
}

interface ThemeState {
  /** Explicit choice, or undefined to follow the operating system. */
  choice?: ThemeMode
  /** Effective theme right now. */
  resolved: ThemeMode
  /** Increments on every effective change; canvas widgets redraw on it. */
  version: number
  toggle: () => void
}

export const useTheme = create<ThemeState>((set, get) => {
  const choice = stored()
  const resolved: ThemeMode = choice ?? (mq?.matches ? 'dark' : 'light')
  mq?.addEventListener('change', () => {
    if (!get().choice) set((s) => ({ resolved: mq.matches ? 'dark' : 'light', version: s.version + 1 }))
  })
  return {
    choice,
    resolved,
    version: 0,
    toggle: () => {
      const next: ThemeMode = get().resolved === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      try {
        localStorage.setItem('lai-theme', next)
      } catch {
        /* private mode: theme still applies for this visit */
      }
      set((s) => ({ choice: next, resolved: next, version: s.version + 1 }))
    },
  }
})
