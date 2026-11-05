/** Every Colab guide in the course, by the id a page passes as `data-props='{"guide":"…"}'`. */
import type { GuideDef } from './notebook.ts'
import { DECODING } from './decoding.ts'
import { QLORA } from './qlora.ts'
import { TRAIN_GPT } from './train-gpt.ts'
import { VLLM_BENCH } from './vllm-bench.ts'

export const GUIDES = {
  decoding: DECODING,
  'train-gpt': TRAIN_GPT,
  qlora: QLORA,
  'vllm-bench': VLLM_BENCH,
}

export type GuideId = keyof typeof GUIDES
export const DEFAULT_GUIDE: GuideId = 'decoding'

export function getGuide(id: string | undefined): GuideDef<unknown> {
  const g = (id && id in GUIDES ? GUIDES[id as GuideId] : GUIDES[DEFAULT_GUIDE]) as unknown
  return g as GuideDef<unknown>
}
