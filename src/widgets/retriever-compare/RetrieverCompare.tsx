import { useMemo, useState } from 'react'
import { BarList, DataGate, DataSource, ScrollRegion, SERIES, Slider, Widget, fmt, pct, useProjectData } from '../kit'
import { rankIds } from '../bm25/engine'
import { loadCorpus } from '../bm25/corpus'
import { rankMetrics } from '../retrieval-metrics/metrics'
import { COMPARE } from './scenarios'

const LIST = 8

export default function RetrieverCompare() {
  const [k, setK] = useState(5)
  const state = useProjectData(loadCorpus)
  const lexical = useMemo(() => {
    if (!state.data) return []
    const scenario = COMPARE[state.project.id]
    return rankIds(state.data.docs, scenario.query, LIST)
  }, [state.data, state.project.id])
  return (
    <Widget name="retriever-compare">
      <DataGate state={state}>
        {(corpus, project) => {
          const s = COMPARE[project.id]
          const titles = new Map(corpus.docs.map((d) => [d.id, d.title]))
          const all = Object.values(s.grades)
          const runs = [
            { name: 'Lexical (BM25)', note: 'computed live', list: lexical },
            { name: 'Dense', note: 'fixed illustration', list: s.dense },
            { name: 'Hybrid + rerank', note: 'fixed illustration', list: s.hybrid },
          ].map((r) => {
            const ranked = r.list.map((id) => s.grades[id] ?? 0)
            return { ...r, linear: rankMetrics(ranked, k, all), exp: rankMetrics(ranked, k, all, 'exponential') }
          })
          return (
            <>
              <DataSource project={project} files={[corpus.file]} />
              <p className="wk-q">
                <b>Query:</b> “{s.query}”
              </p>
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
