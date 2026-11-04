/** Fixed-size and section-aware word chunking. Pure, so it can be tested without a browser. */
export interface Section {
  heading: string
  text: string
}
export type ChunkMode = 'fixed' | 'section'
export interface Chunk {
  words: string[]
  /** Leading words repeated from the previous chunk. */
  overlap: number
  /** Context header stored with the chunk (section-aware mode only). */
  header: string
  /** How many document sections this chunk's words come from. */
  sections: number
}
export interface ChunkStats {
  chunks: number
  sourceWords: number
  storedWords: number
  overlapOverheadPct: number
  headerWords: number
  /** Chunks whose words span two or more sections, which is how a rule loses its exception. */
  mixed: number
}

const wordsOf = (s: string) => s.split(/\s+/).filter(Boolean)

/** Windows of `size` words, each starting `size - overlap` after the last; the last window reaches the end. */
export function windows(words: string[], size: number, overlap: number): { start: number; end: number; overlap: number }[] {
  const ov = Math.min(overlap, size - 1)
  const stride = Math.max(1, size - ov)
  const out: { start: number; end: number; overlap: number }[] = []
  for (let i = 0; i < words.length; i += stride) {
    const end = Math.min(words.length, i + size)
    out.push({ start: i, end, overlap: i > 0 ? Math.min(ov, end - i) : 0 })
    if (end >= words.length) break
  }
  return out
}

export function chunkDocument(title: string, sections: Section[], mode: ChunkMode, size: number, overlap: number): Chunk[] {
  if (mode === 'fixed') {
    const words: string[] = []
    const owner: number[] = []
    sections.forEach((s, i) => {
      for (const w of wordsOf(`${s.heading}. ${s.text}`)) {
        words.push(w)
        owner.push(i)
      }
    })
    return windows(words, size, overlap).map((w) => ({
      words: words.slice(w.start, w.end),
      overlap: w.overlap,
      header: '',
      sections: new Set(owner.slice(w.start, w.end)).size,
    }))
  }
  return sections.flatMap((s) => {
    const words = wordsOf(s.text)
    return windows(words, size, overlap).map((w) => ({
      words: words.slice(w.start, w.end),
      overlap: w.overlap,
      header: `${title} › ${s.heading}`,
      sections: 1,
    }))
  })
}

export function chunkStats(sections: Section[], mode: ChunkMode, chunks: Chunk[]): ChunkStats {
  const sourceWords = sections.reduce((n, s) => n + wordsOf(mode === 'fixed' ? `${s.heading}. ${s.text}` : s.text).length, 0)
  const storedWords = chunks.reduce((n, c) => n + c.words.length, 0)
  return {
    chunks: chunks.length,
    sourceWords,
    storedWords,
    overlapOverheadPct: sourceWords ? (storedWords / sourceWords - 1) * 100 : 0,
    headerWords: chunks.reduce((n, c) => n + wordsOf(c.header).length, 0),
    mixed: chunks.filter((c) => c.sections > 1).length,
  }
}
