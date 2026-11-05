import { gateFor, type Gate, type WorkerLike } from '../kit'
import { EMBEDDINGS, PYTHON, TOKENIZERS } from './specs'

/** The worker's name tells a test stub which engine it stands in for. Vite needs the `new Worker(new URL(...))` form to bundle it. */
const openTransformers = (name: string) => () => new Worker(new URL('./transformers.worker.ts', import.meta.url), { type: 'module', name }) as unknown as WorkerLike

export const embeddingsGate = (): Gate => gateFor(EMBEDDINGS, openTransformers('lai-embeddings'))
export const tokenizersGate = (): Gate => gateFor(TOKENIZERS, openTransformers('lai-tokenizers'))
export const pythonGate = (): Gate => gateFor(PYTHON, () => new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module', name: 'lai-python' }) as unknown as WorkerLike)
