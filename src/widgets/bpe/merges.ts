/** Byte-pair-style encoding on characters: repeatedly merge the most frequent adjacent pair. Pure. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'

export interface BpeWord {
  symbols: string[]
  count: number
}
export interface BpeState {
  words: BpeWord[]
  /** The tokens that merges have created, in order. */
  merges: string[]
  /** What the last step did, or null at the start. */
  last: { left: string; right: string; merged: string; seen: number } | null
  /** No pair occurs more than once, so training has ended. */
  finished: boolean
}

const WORD_START = '▁'

/** Keeps letters, combining marks and digits, so a vowel sign in a Tamil word stays in its word. */
export function initWords(text: string): BpeWord[] {
  const counts = new Map<string, number>()
  for (const raw of text.toLowerCase().split(/\s+/)) {
    const w = raw.replace(/[^\p{L}\p{M}\p{N}]/gu, '')
    if (w) counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  return [...counts].map(([w, count]) => ({ symbols: [WORD_START, ...w], count }))
}

/** The most frequent adjacent pair, weighted by word count, if it occurs more than once. The first such pair wins a tie. */
export function bestPair(words: BpeWord[]): { left: string; right: string; seen: number } | null {
  const counts = new Map<string, { left: string; right: string; seen: number }>()
  for (const w of words) {
    for (let i = 0; i < w.symbols.length - 1; i++) {
      const key = `${w.symbols[i]}\u0000${w.symbols[i + 1]}`
      const hit = counts.get(key) ?? { left: w.symbols[i], right: w.symbols[i + 1], seen: 0 }
      hit.seen += w.count
      counts.set(key, hit)
    }
  }
  let best: { left: string; right: string; seen: number } | null = null
  for (const c of counts.values()) if (c.seen > (best?.seen ?? 1)) best = c
  return best
}

function merge(words: BpeWord[], left: string, right: string): BpeWord[] {
  const merged = left + right
  return words.map((w) => {
    const symbols: string[] = []
    for (let i = 0; i < w.symbols.length; i++) {
      if (i < w.symbols.length - 1 && w.symbols[i] === left && w.symbols[i + 1] === right) {
        symbols.push(merged)
        i++
      } else symbols.push(w.symbols[i])
    }
    return { ...w, symbols }
  })
}

/** Training state after at most `steps` merges of this text. */
export function trainBpe(text: string, steps: number): BpeState {
  let state: BpeState = { words: initWords(text), merges: [], last: null, finished: false }
  for (let i = 0; i < steps; i++) {
    const pair = bestPair(state.words)
    if (!pair) return { ...state, finished: true }
    const merged = pair.left + pair.right
    state = { words: merge(state.words, pair.left, pair.right), merges: [...state.merges, merged], last: { ...pair, merged }, finished: false }
  }
  return state
}

export function bpeStats(state: BpeState) {
  const vocab = new Set(state.words.flatMap((w) => w.symbols))
  return { vocabulary: vocab.size, tokens: state.words.reduce((n, w) => n + w.symbols.length * w.count, 0) }
}

export const CLASSIC_TEXT = 'low lower lowest newer newest wider widest slow slower slowest low low newest'

interface Doc {
  text: string
}

/** Text from the project's dataset to train on, next to the classic example. */
export async function loadBpeText(p: Project, read: DataReader): Promise<{ file: string; text: string }> {
  const file = p.id === 'store' ? 'chats.json' : p.id === 'travel' ? 'messages.json' : 'policies.json'
  const rows = await read.json<Doc[]>(file)
  return { file, text: rows.slice(0, 6).map((r) => r.text).join(' ') }
}
