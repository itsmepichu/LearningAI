/** Every walkthrough, by the id a page passes as `data-props='{"story":"…"}'`. */
import type { Story } from './story.ts'
import { RAG } from './stories/rag.ts'
import { AGENT } from './stories/agent.ts'
import { SERVING } from './stories/serving.ts'
import { TRAINING } from './stories/training.ts'
import { PAPER_TRANSFORMER } from './stories/paper-transformer.ts'
import { PAPER_RAG } from './stories/paper-rag.ts'

export const STORIES = { rag: RAG, agent: AGENT, serving: SERVING, training: TRAINING, 'paper-transformer': PAPER_TRANSFORMER, 'paper-rag': PAPER_RAG }
export type StoryId = keyof typeof STORIES

export function getStory(id: string | undefined): Story<unknown> | null {
  return id && id in STORIES ? (STORIES[id as StoryId] as unknown as Story<unknown>) : null
}
