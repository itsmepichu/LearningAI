import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'

export interface Sample {
  language: string
  text: string
}

const LANGUAGE: Record<string, string> = { en: 'English', de: 'German', ta: 'Tamil' }

/** The first message in each language, so the reader can compare scripts on real rows from the dataset. */
export function firstPerLanguage(rows: { language: string; text: string }[]): Sample[] {
  const seen = new Map<string, string>()
  for (const r of rows) if (r.text && !seen.has(r.language)) seen.set(r.language, r.text)
  return [...seen].map(([code, text]) => ({ language: LANGUAGE[code] ?? code, text }))
}

export async function loadSamples(p: Project, read: DataReader): Promise<{ file: string; samples: Sample[] }> {
  if (p.id === 'store' || p.id === 'travel') {
    const file = p.id === 'store' ? 'chats.json' : 'messages.json'
    return { file, samples: firstPerLanguage(await read.json<{ language: string; text: string }[]>(file)) }
  }
  const file = p.id === 'bank' ? 'disputes.csv' : 'tickets.csv'
  return { file, samples: firstPerLanguage((await read.csv(file)) as { language: string; text: string }[]) }
}
