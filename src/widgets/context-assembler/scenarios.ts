import type { Project, ProjectId } from '../../data/projects'
import type { DataReader } from '../kit'
import { loadCorpus } from '../bm25/corpus.ts'
import type { ContextItem } from './assemble'

/** Documents retrieved for this project's request, best first. Their titles come from the dataset. */
const CHUNKS: Record<ProjectId, string[]> = {
  harbor: ['HP-009', 'HP-010', 'HP-008', 'HP-013', 'HP-011', 'HP-014'],
  store: ['BZ-FOO-1102', 'BZ-FOO-1205', 'BZ-FOO-1080', 'BZ-FOO-1290', 'BZ-FOO-1084', 'BZ-FOO-1030'],
  bank: ['NB-002', 'NB-001', 'NB-005', 'NB-006', 'NB-007', 'NB-003'],
  travel: ['SR-002', 'SR-001', 'SR-003', 'SR-007', 'SR-004', 'SR-006'],
}
const LIVE: Record<ProjectId, { context: string; tool: string }> = {
  harbor: { context: 'Customer plan + open incidents', tool: 'Ticket history tool output' },
  store: { context: 'Shopper profile + open order', tool: 'Order history tool output' },
  bank: { context: 'Customer profile + open case', tool: 'Transaction history tool output' },
  travel: { context: 'Traveller profile + trip', tool: 'Live fare search tool output' },
}
/** Illustrative sizes in tokens: [tokens, priority, compressed size], with the score shown for each chunk. */
const CHUNK_SIZES: [number, number, number, string][] = [
  [520, 3, 260, '.91'],
  [480, 3, 240, '.87'],
  [610, 3, 300, '.82'],
  [450, 5, 220, '.74'],
  [700, 5, 350, '.61'],
  [500, 6, 250, '.55'],
]

export async function loadContextItems(p: Project, read: DataReader): Promise<{ file: string; items: ContextItem[] }> {
  const corpus = await loadCorpus(p, read)
  const title = (id: string) => corpus.docs.find((d) => d.id === id)!.title
  const chunks: ContextItem[] = CHUNKS[p.id].map((id, i) => {
    const [tokens, priority, compressed, score] = CHUNK_SIZES[i]
    return { name: `Chunk: ${title(id)} (score ${score})`, tokens, priority, compressed, kind: 'retrieved' }
  })
  const live = LIVE[p.id]
  return {
    file: corpus.file,
    items: [
      { name: `${p.assistant} system prompt`, tokens: 900, priority: 0, compressed: null, kind: 'instructions' },
      { name: 'Tool schemas', tokens: 600, priority: 0, compressed: null, kind: 'instructions' },
      { name: 'Current question', tokens: 120, priority: 0, compressed: null, kind: 'conversation' },
      { name: live.context, tokens: 200, priority: 1, compressed: null, kind: 'live' },
      { name: 'Last 4 turns (verbatim)', tokens: 800, priority: 2, compressed: null, kind: 'conversation' },
      ...chunks.slice(0, 3),
      { name: live.tool, tokens: 2600, priority: 4, compressed: 300, kind: 'live' },
      ...chunks.slice(3),
      { name: 'Older history (turns 1–16)', tokens: 3400, priority: 7, compressed: 350, kind: 'conversation' },
    ],
  }
}
