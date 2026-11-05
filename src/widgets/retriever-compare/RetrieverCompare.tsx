import { useMemo, useState } from 'react'
import { BarList, DataGate, DataSource, ScrollRegion, SERIES, Slider, Widget, fmt, pct, useProjectData } from '../kit'
import { rankIds } from '../bm25/engine'
import { loadCorpus } from '../bm25/corpus'
import { EMBEDDING_NAME } from '../engines/specs'
import { rankMetrics } from '../retrieval-metrics/metrics'
import { RealDensePanel } from '../vector-search/RealDensePanel'
import { useCorpusEmbedding, useDenseSearch } from '../vector-search/useEmbeddings'
import { compareRuns } from './runs'
import { COMPARE } from './scenarios'

const LIST = 8

export default function RetrieverCompare() {
  const [k, setK] = useState(5)
  const [illustrate, setIllustrate] = useState(false)
  const state = useProjectData(loadCorpus)
  const query = COMPARE[state.project.id].query
  const lexical = useMemo(() => (state.data ? rankIds(state.data.docs, query, LIST) : []), [state.data, query])
  const emb = useCorpusEmbedding(state.data, state.project.id)
  const { hits } = useDenseSearch(emb, state.data, query, LIST * 2)
  return (
    <Widget name="retriever-compare">
      <DataGate state={state}>
        {(corpus, project) => {
          const s = COMPARE[project.id]
          const titles = new Map(corpus.docs.map((d) => [d.id, d.title]))
          const all = Object.values(s.grades)
          const real = hits && !illustrate ? hits.map((h) => h.id) : null
          const runs = compareRuns(s, lexical, real, EMBEDDING_NAME, LIST).map((r) => {
            const ranked = r.list.map((id) => s.grades[id] ?? 0)
            return { ...r, linear: rankMetrics(ranked, k, all), exp: rankMetrics(ranked, k, all, 'exponential') }
          })
          return (
            <>
              <DataSource project={project} files={[corpus.file]} />
              <p className="wk-q">
                <b>Query:</b> “{s.query}”
              </p>
              <RealDensePanel emb={emb} noun={corpus.noun} offer="Replace the illustration with a real embedding model" without="Until then the dense and hybrid columns stay a fixed illustration, and say so.">
                <div className="wk-chips">
                  <span>Dense column shows</span>
                  <button type="button" className="wk-chip" aria-pressed={!illustrate} onClick={() => setIllustrate(false)}>
                    Real model
                  </button>
                  <button type="button" className="wk-chip" aria-pressed={illustrate} onClick={() => setIllustrate(true)}>
                    Fixed illustration
                  </button>
                </div>
                <p className="wk-hint">
                  The grades are this course’s own judgement of one query, so these metrics show how a real model ranked it, not which retriever is better. That takes a labelled set of queries.{' '}
                  <a href="https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2" target="_blank" rel="noreferrer">
                    Model card
                  </a>
                  .
                </p>
              </RealDensePanel>
              <Slider label="Cutoff k" value={k} min={1} max={LIST} onChange={setK} />
              <div className="cols3 wk-cols">
                {runs.map((r) => (
                  <div className="card" key={r.name}>
                    <span className="wk-col-h">{r.name}</span>
                    <small>{r.note}</small>
                    <ol>
                      {r.list.map((id, i) => {
                        const g = s.grades[id]
                        return (
                          <li key={id} className={(i < k && g ? 'rel' : '') + (i < k ? '' : ' past')}>
                            {titles.get(id) ?? id}
                            {g ? ` · grade ${g}` : ''}
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                ))}
              </div>
              <ScrollRegion label="Metrics for each retriever">
                <table>
                  <thead>
                    <tr>
                      <th>Retriever</th>
                      <th>Recall@{k}</th>
                      <th>Precision@{k}</th>
                      <th>RR</th>
                      <th>nDCG@{k} linear</th>
                      <th>nDCG@{k} 2^rel−1</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.name}>
                        <td>{r.name}</td>
                        <td>{pct(r.linear.recall)}</td>
                        <td>{pct(r.linear.precision)}</td>
                        <td>{fmt(r.linear.rr, 2)}</td>
                        <td>{fmt(r.linear.ndcg, 3)}</td>
                        <td>{fmt(r.exp.ndcg, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollRegion>
              <BarList max={1} items={runs.map((r) => ({ label: `${r.name}, nDCG@${k}`, value: r.linear.ndcg, text: fmt(r.linear.ndcg, 3), color: SERIES[0] }))} />
            </>
          )
        }}
      </DataGate>
    </Widget>
  )
}
