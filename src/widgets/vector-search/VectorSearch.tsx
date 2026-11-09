import { useEffect, useId, useMemo, useState } from 'react'
import { BarList, DataGate, DataSource, KpiRow, ScrollRegion, SERIES, Slider, Widget, fmt, formatBytes, pct, useProjectData, type GateState } from '../kit'
import { SUGGESTIONS, loadCorpus, type Corpus } from '../bm25/corpus'
import { rankIds } from '../bm25/engine'
import { COMPARE } from '../retriever-compare/scenarios'
import { EMBEDDING_DIMS, EMBEDDING_NAME } from '../engines/specs'
import type { Project } from '../../data/projects'
import { RealDensePanel } from './RealDensePanel'
import { embedQuery, useCorpusEmbedding, useDenseSearch, type CorpusEmbedding } from './useEmbeddings'
import { quantisationReport, type QuantRow } from './vector'

const TOP = 6

function Search({ corpus, project, emb }: { corpus: Corpus; project: Project; emb: CorpusEmbedding }) {
  const id = useId()
  const suggestions = SUGGESTIONS[project.id]
  const [query, setQuery] = useState(suggestions[suggestions.length - 1].q)
  const { hits, ms } = useDenseSearch(emb, corpus, query, TOP)
  const titles = useMemo(() => new Map(corpus.docs.map((d) => [d.id, d])), [corpus])
  const lexical = useMemo(() => rankIds(corpus.docs, query, corpus.docs.length), [corpus, query])
  return (
    <>
      <label htmlFor={id} className="wk-q-in">
        Query
        <input id={id} type="text" value={query} autoComplete="off" spellCheck={false} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="wk-chips">
        <span>Try</span>
        {suggestions.map((s) => (
          <button key={s.q} type="button" className="wk-chip" aria-pressed={s.q === query} onClick={() => setQuery(s.q)}>
            {s.q}
          </button>
        ))}
      </div>
      <KpiRow
        items={[
          { label: `${corpus.noun} embedded`, value: fmt(corpus.docs.length) },
          { label: 'dimensions per vector', value: fmt(EMBEDDING_DIMS) },
          { label: 'comparisons for this query (an exact scan)', value: fmt(corpus.docs.length) },
          { label: 'to embed the query and scan, on this device', value: ms === null ? '…' : `${fmt(ms, 0)} ms` },
        ]}
      />
      <ScrollRegion label="Dense results beside BM25">
        <table>
          <thead>
            <tr>
              <th>Dense rank</th>
              <th>Doc</th>
              <th>Cosine</th>
              <th>BM25 rank</th>
              <th>Text</th>
            </tr>
          </thead>
          <tbody>
            {(hits ?? []).map((h, i) => {
              const at = lexical.indexOf(h.id)
              return (
                <tr key={h.id}>
                  <td>{i + 1}</td>
                  <td>
                    <code>{h.id}</code>
                  </td>
                  <td>{fmt(h.score, 3)}</td>
                  <td>{at < 0 ? 'no term matches' : at + 1}</td>
                  <td className="wk-hit">
                    {titles.get(h.id)?.title}
                    <small>{titles.get(h.id)?.body}</small>
                  </td>
                </tr>
              )
            })}
            {!hits && (
              <tr className="wk-none">
                <td colSpan={5}>{query.trim() ? 'Searching…' : 'Type a query to search.'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollRegion>
    </>
  )
}

/** The questions a quantisation trial runs: the project's own queries, then document titles, which also stand in for real questions. */
function trialQueries(corpus: Corpus, project: Project): string[] {
  const own = [...SUGGESTIONS[project.id].map((s) => s.q), COMPARE[project.id].query]
  return [...new Set([...own, ...corpus.docs.slice(0, 30).map((d) => d.title)])]
}

function Quantise({ corpus, project, emb }: { corpus: Corpus; project: Project; emb: CorpusEmbedding }) {
  const [k, setK] = useState(3)
  const [queries, setQueries] = useState<number[][] | null>(null)
  const { gate, vectors } = emb
  useEffect(() => {
    if (!vectors) return
    let live = true
    setQueries(null)
    Promise.all(trialQueries(corpus, project).map((q) => embedQuery(gate, q))).then(
      (q) => {
        if (live) setQueries(q)
      },
      () => {
        // Stays on the "embedding" line; the corpus error state covers a worker that stopped.
      },
    )
    return () => {
      live = false
    }
  }, [vectors, corpus, project, gate])
  const max = Math.min(10, corpus.docs.length)
  const rows: QuantRow[] | null = useMemo(() => {
    if (!vectors || !queries) return null
    return quantisationReport(corpus.docs.map((d) => d.id), vectors, queries, Math.min(k, max))
  }, [vectors, queries, corpus, k, max])
  if (!rows || !queries) return <p role="status">Embedding the test queries…</p>
  return (
    <>
      <Slider label="Top k" value={Math.min(k, max)} min={1} max={max} onChange={setK} />
      <ScrollRegion label="Recall and memory for each code">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Bytes per vector</th>
              <th>Memory for {fmt(corpus.docs.length)} documents</th>
              <th>Recall@{Math.min(k, max)} against the exact scan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.label}</td>
                <td>{fmt(r.bytesPerVector)}</td>
                <td>{fmtKb(r.bytesPerVector * corpus.docs.length)}</td>
                <td>{pct(r.recall)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      <BarList max={1} items={rows.map((r) => ({ label: r.label, value: r.recall, text: pct(r.recall), color: SERIES[0] }))} />
      <p className="wk-hint">
        Averaged over {fmt(queries.length)} queries: {project.company}’s example queries and document titles.
      </p>
    </>
  )
}

const fmtKb = (bytes: number) => (bytes < 100_000 ? `${fmt(bytes / 1000, 1)} kB` : formatBytes(bytes))

const VIEWS = {
  search: {
    offer: `Search these documents with a real embedding model`,
    without: 'BM25 above works without it.',
    proves: 'This shows how one small open model ranks one small corpus, by an exact scan. It does not show that dense search beats BM25, what a production model would do, or how an index behaves at scale. The model was trained mostly on English, so expect Tamil queries to do worse.',
  },
  quantise: {
    offer: `Measure quantisation on real embeddings of these documents`,
    without: 'The memory chart below works without it.',
    proves: 'These are real recall figures, but on very few vectors, where a top-k list is an easy target. They show the direction of the tradeoff and how to measure it, not the recall you would get on millions of vectors, and no HNSW graph is involved.',
  },
}

/** Live offer text for a state that needs none, so the first paint has the right words. */
const ready = (s: GateState) => s.status === 'ready'

export default function VectorSearch({ view = 'search' }: { view?: keyof typeof VIEWS }) {
  const state = useProjectData(loadCorpus)
  const emb = useCorpusEmbedding(state.data, state.project.id)
  const words = VIEWS[view] ?? VIEWS.search
  return (
    <Widget name={view === 'quantise' ? 'vector-quant' : 'vector-search'}>
      <DataGate state={state}>
        {(corpus, project) => (
          <>
            <DataSource project={project} files={[corpus.file]}>
              {ready(emb.state) ? `${EMBEDDING_NAME} runs on this device, in a worker.` : 'Nothing is embedded until you choose.'}
            </DataSource>
            <RealDensePanel emb={emb} noun={corpus.noun} offer={words.offer} without={words.without}>
              {view === 'quantise' ? <Quantise corpus={corpus} project={project} emb={emb} /> : <Search corpus={corpus} project={project} emb={emb} />}
              <p className="wk-hint">
                <b>Real, and limited.</b> {words.proves}{' '}
                <a href="https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2" target="_blank" rel="noreferrer">
                  Model card
                </a>
                .
              </p>
            </RealDensePanel>
          </>
        )}
      </DataGate>
    </Widget>
  )
}
