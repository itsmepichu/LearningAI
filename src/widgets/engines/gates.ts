import { gateFor, type Gate, type WorkerLike } from '../kit'
import { EMBEDDINGS } from './specs'

/** The worker's name tells a test stub which engine it stands in for. Vite needs the `new Worker(new URL(...))` form to bundle it. */
const openTransformers = (name: string) => () => new Worker(new URL('./transformers.worker.ts', import.meta.url), { type: 'module', name }) as unknown as WorkerLike

export const embeddingsGate = (): Gate => gateFor(EMBEDDINGS, openTransformers('lai-embeddings'))
