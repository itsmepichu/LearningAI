import { DownloadGate, fmt } from '../kit'
import { EMBEDDING_NAME } from '../engines/specs'
import type { CorpusEmbedding } from './useEmbeddings'

/**
 * The opt-in for real embeddings, shared by the figures that use them, and what they do while the corpus is embedded.
 * `offer` says what opting in changes in this figure; `without` says what it shows until then; `children` shows once it runs.
 */
export function RealDensePanel({ emb, noun, offer, without, children }: { emb: CorpusEmbedding; noun: string; offer: string; without: string; children?: React.ReactNode }) {
  const { gate, state, vectors, progress, error } = emb
  return (
    <DownloadGate gate={gate} state={state} offer={offer} without={without}>
      {error ? (
        <p role="alert">Embedding stopped: {error}</p>
      ) : !vectors ? (
        <p role="status">
          {progress ? `Embedding ${noun}: ${fmt(progress.done)} of ${fmt(progress.total)}, in a worker on this device…` : `Embedding ${noun} with ${EMBEDDING_NAME}…`}
        </p>
      ) : (
        children
      )}
    </DownloadGate>
  )
}
