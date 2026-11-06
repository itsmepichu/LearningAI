/** Every walkthrough, by the id a page passes as `data-props='{"story":"…"}'`. */
import type { Story } from './story.ts'
import { RAG } from './stories/rag.ts'
import { AGENT } from './stories/agent.ts'
import { SERVING } from './stories/serving.ts'
import { TRAINING } from './stories/training.ts'

export const STORIES = { rag: RAG, agent: AGENT, serving: SERVING, training: TRAINING }
export type StoryId = keyof typeof STORIES

export function getStory(id: string | undefined): Story<unknown> | null {
  return id && id in STORIES ? (STORIES[id as StoryId] as unknown as Story<unknown>) : null
}
