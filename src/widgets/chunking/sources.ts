import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import type { Section } from './chunk'

export interface ChunkSource {
  title: string
  files: string[]
  sections: Section[]
}

interface Doc {
  id: string
  title: string
  text: string
}
interface Review {
  sku: string
  language: string
  text: string
  is_injection: boolean
}

const pick = (rows: Doc[], ids: string[]): Section[] =>
  ids.flatMap((id) => {
    const d = rows.find((r) => r.id === id)
    return d ? [{ heading: d.title, text: d.text }] : []
  })

const REVIEW_SKU = 'BZ-KIT-1097'
const LANGUAGE: Record<string, string> = { en: 'English', ta: 'Tamil' }

/** One short document from each project's dataset, picked so that fixed-size windows cut across real rules. */
export async function loadChunkSource(p: Project, read: DataReader): Promise<ChunkSource> {
  if (p.id === 'store') {
    const [products, reviews] = await Promise.all([read.csv('products.csv'), read.json<Review[]>('reviews.json')])
    const item = products.find((r) => r.sku === REVIEW_SKU)!
    const byLanguage = new Map<string, string[]>()
    for (const r of reviews) {
      if (r.sku !== REVIEW_SKU || r.is_injection) continue
      byLanguage.set(r.language, [...(byLanguage.get(r.language) ?? []), r.text])
    }
    return {
      title: item.title,
      files: ['products.csv', 'reviews.json'],
      sections: [
        { heading: 'Listing', text: `${item.title}. Sold by ${item.brand} in ${item.category}. Price ${item.price_inr} rupees. Rated ${item.rating} from ${item.review_count} reviews.` },
        ...[...byLanguage].map(([lang, texts]) => ({ heading: `Reviews in ${LANGUAGE[lang] ?? lang}`, text: texts.join(' ') })),
      ],
    }
  }
  if (p.id === 'travel') {
    const rows = await read.json<Doc[]>('fare_rules.json')
    return { title: `${p.company} flight rules`, files: ['fare_rules.json'], sections: pick(rows, ['SR-001', 'SR-002', 'SR-003', 'SR-007']) }
  }
  const rows = await read.json<Doc[]>('policies.json')
  return p.id === 'bank'
    ? { title: `${p.company} UPI and dispute policies`, files: ['policies.json'], sections: pick(rows, ['NB-001', 'NB-002', 'NB-005', 'NB-006']) }
    : { title: `${p.company} staff handbook`, files: ['policies.json'], sections: pick(rows, ['HP-001', 'HP-002', 'HP-003', 'HP-004']) }
}
