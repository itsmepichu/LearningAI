import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'

export interface Sample {
  language: string
  text: string
}
export interface SampleSet {
  file: string
  samples: Sample[]
}

const PER_LANGUAGE = 4

export const LANGUAGE_NAMES: Record<string, string> = { en: 'English', de: 'German', ta: 'Tamil' }

/** Up to four different messages per language, in the order the file has them. */
function pickSamples(rows: { language: string; text: string }[]): Sample[] {
  const taken = new Map<string, Set<string>>()
  for (const r of rows) {
    const seen = taken.get(r.language) ?? new Set<string>()
    if (seen.size < PER_LANGUAGE) seen.add(r.text)
    taken.set(r.language, seen)
  }
  return [...taken].flatMap(([language, texts]) => [...texts].map((text) => ({ language, text })))
}

/** Each project's multilingual messages: Harbor has three (English, German, Tamil), the other projects two (English, Tamil). */
export async function loadTokenizerSamples(p: Project, read: DataReader): Promise<SampleSet> {
  if (p.id === 'travel') return { file: 'messages.json', samples: pickSamples(await read.json<Sample[]>('messages.json')) }
  if (p.id === 'store') return { file: 'chats.json', samples: pickSamples(await read.json<Sample[]>('chats.json')) }
  const file = p.id === 'bank' ? 'disputes.csv' : 'tickets.csv'
  return { file, samples: pickSamples((await read.csv(file)) as unknown as Sample[]) }
}

export interface Tokenized {
  /** What each token decodes to, for display. A piece of a character decodes to the replacement character. */
  pieces: string[]
}

export interface LanguageRow {
  language: string
  messages: number
  /** Characters by code point, so one Tamil letter is not counted as two UTF-16 units. */
  meanChars: number
  /** Mean tokens per message for each tokenizer, in the order given. */
  meanTokens: number[]
}

/** `results[t][s]` holds tokenizer t's output for sample s. Pure. */
export function perLanguage(samples: Sample[], results: Tokenized[][]): LanguageRow[] {
  const langs = [...new Set(samples.map((s) => s.language))]
  return langs.map((language) => {
    const at = samples.flatMap((s, i) => (s.language === language ? [i] : []))
    const mean = (f: (i: number) => number) => at.reduce((sum, i) => sum + f(i), 0) / at.length
    return {
      language,
      messages: at.length,
      meanChars: mean((i) => [...samples[i].text].length),
      meanTokens: results.map((r) => mean((i) => r[i].pieces.length)),
    }
  })
}

/** How many tokens hold only part of a character: a tokenizer that split a script below its letters. */
export const brokenPieces = (t: Tokenized) => t.pieces.filter((p) => p.includes('�')).length
