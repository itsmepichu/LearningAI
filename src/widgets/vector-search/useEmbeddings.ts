import { useEffect, useMemo, useState } from 'react'
import { CallCancelled, useGate, type Gate, type GateState } from '../kit'
import { embeddingsGate } from '../engines/gates'
import type { Corpus } from '../bm25/corpus'
import { exactSearch, type Hit } from './vector'

export interface Progress {
  done: number
  total: number
}

/** A corpus is embedded once per page load, and every widget on the page shares it. A failure is forgotten, so it can be retried. */
const corpusVectors = new Map<string, Promise<number[][]>>()
const queryVectors = new Map<string, Promise<number[]>>()

function embedCorpus(gate: Gate, corpus: Corpus, key: string, onProgress: (p: Progress) => void): Promise<number[][]> {
  let hit = corpusVectors.get(key)
  if (!hit) {
    hit = gate.call<number[][]>('embed', { texts: corpus.docs.map((d) => d.text) }, (e) => onProgress(e as Progress))
    hit.catch(() => corpusVectors.delete(key))
    corpusVectors.set(key, hit)
  }
  return hit
}

export function embedQuery(gate: Gate, text: string): Promise<number[]> {
  let hit = queryVectors.get(text)
  if (!hit) {
    hit = gate.call<number[][]>('embed', { texts: [text] }).then((r) => r[0])
    hit.catch(() => queryVectors.delete(text))
    queryVectors.set(text, hit)
  }
  return hit
}

export interface CorpusEmbedding {
  gate: Gate
  state: GateState
  /** One per document, in corpus order, once the model is loaded and has run over them. */
  vectors: number[][] | null
  progress: Progress | null
  error: string | null
}

/** Embeds the corpus after the reader has opted in. Before that it does nothing at all. */
export function useCorpusEmbedding(corpus: Corpus | null, projectId: string): CorpusEmbedding {
  const gate = useMemo(embeddingsGate, [])
  const state = useGate(gate)
  const ready = state.status === 'ready'
  const [done, setDone] = useState<{ key: string; vectors: number[][] } | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const key = corpus ? `${projectId}:${corpus.file}` : ''
  useEffect(() => {
    if (!ready || !corpus) return
    let live = true
    setError(null)
    setProgress(null)
    embedCorpus(gate, corpus, key, (p) => live && setProgress(p)).then(
      (vectors) => {
        if (live) setDone({ key, vectors })
      },
      (e) => {
        if (live && !(e instanceof CallCancelled)) setError(e instanceof Error ? e.message : String(e))
      },
    )
    return () => {
      live = false
    }
  }, [ready, corpus, gate, key])
  return { gate, state, vectors: ready && done?.key === key ? done.vectors : null, progress, error }
}

/** Exact cosine search for one query. While the query changes it keeps the previous answer out, so a stale list never shows. */
export function useDenseSearch(emb: CorpusEmbedding, corpus: Corpus | null, query: string, limit?: number): { hits: Hit[] | null; ms: number | null } {
  const [result, setResult] = useState<{ query: string; key: unknown; hits: Hit[]; ms: number } | null>(null)
  const { vectors, gate } = emb
  const text = query.trim()
  useEffect(() => {
    if (!vectors || !corpus || !text) return
    let live = true
    const ids = corpus.docs.map((d) => d.id)
    const start = performance.now()
    const timer = setTimeout(() => {
      embedQuery(gate, text).then(
        (q) => {
          if (live) setResult({ query: text, key: vectors, hits: exactSearch(ids, vectors, q, limit), ms: performance.now() - start })
        },
        () => {
          // The corpus error state covers a worker that stopped; a single failed query just keeps no answer.
        },
      )
    }, 200)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [vectors, corpus, text, gate, limit])
  return result && result.query === text && result.key === vectors ? { hits: result.hits, ms: result.ms } : { hits: null, ms: null }
}
