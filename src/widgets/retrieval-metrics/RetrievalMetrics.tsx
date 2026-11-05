import { useMemo, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { DataGate, DataSource, KpiRow, LineChart, SERIES, Slider, Widget, fmt, pct, useProjectData } from '../kit'
import { loadCorpus, type Corpus } from '../bm25/corpus'
import { rankMetrics, relevantGrades } from './metrics'
import { SCENARIOS, type RankingScenario } from './scenarios'

function Ranking({ corpus, scenario }: { corpus: Corpus; scenario: RankingScenario }) {
  const [order, setOrder] = useState(scenario.ranked)
  const [grades, setGrades] = useState(scenario.grades)
  const [k, setK] = useState(5)
  const titles = useMemo(() => new Map(corpus.docs.map((d) => [d.id, d.title])), [corpus])
  const ranked = order.map((id) => grades[id] ?? 0)
  const relevant = relevantGrades(ranked)
  const now = rankMetrics(ranked, k, relevant)
  const ks = order.map((_, i) => i + 1)
  const at = ks.map((c) => rankMetrics(ranked, c, relevant))
  const moveUp = (i: number) => {
    const next = [...order]
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    setOrder(next)
  }
  const cycle = (id: string) => setGrades((g) => ({ ...g, [id]: ((g[id] ?? 0) + 1) % 4 }))
  return (
    <>
      <p className="wk-q">
        <b>Query:</b> “{scenario.query}” <b>{relevant.length}</b> {relevant.length === 1 ? 'result is' : 'results are'} marked relevant. Select a result to cycle its grade (0 → 1 → 2 → 3), or
        move it up the ranking with the arrow.
      </p>
      <ol className="wk-rows">
        {order.map((id, i) => {
          const g = grades[id] ?? 0
          const inTop = i < k
          return (
            <li key={id}>
              <button type="button" className={'wk-row' + (g ? ' rel' : '') + (inTop ? '' : ' past')} onClick={() => cycle(id)}>
                <span className="wk-row-n">#{i + 1}</span>
                <span>{titles.get(id) ?? id}</span>
                <span className="wk-row-g">
                  grade {g}
                  {inTop ? '' : ' · past k'}
                </span>
              </button>
              <button type="button" className="wk-up" aria-label={`Move ${titles.get(id) ?? id} up one rank`} disabled={i === 0} onClick={() => moveUp(i)}>
                <ArrowUp aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ol>
      <div className="ctl">
        <button
          type="button"
          className="btn"
          onClick={() => {
            setOrder(scenario.ranked)
            setGrades(scenario.grades)
          }}
        >
          Reset ranking
        </button>
      </div>
      <Slider label="Cutoff k" value={k} min={1} max={order.length} onChange={setK} />
      <KpiRow
        items={[
          { label: `Recall@${k}`, value: pct(now.recall) },
          { label: `Precision@${k}`, value: pct(now.precision) },
          { label: `Reciprocal rank (this query, within ${k})`, value: fmt(now.rr, 3) },
          { label: `nDCG@${k}`, value: fmt(now.ndcg, 3) },
        ]}
      />
      <LineChart
        x={ks}
        marker={k}
        xLabel="k"
        format={(v) => fmt(v, 2)}
        label={`Recall, precision and nDCG at each cutoff from 1 to ${order.length}, for the ranking above. At k = ${k}: recall ${pct(now.recall)}, precision ${pct(now.precision)}, nDCG ${fmt(now.ndcg, 3)}.`}
        series={[
          { name: 'Recall@k', color: SERIES[0], values: at.map((m) => m.recall) },
          { name: 'Precision@k', color: SERIES[1], values: at.map((m) => m.precision) },
          { name: 'nDCG@k', color: SERIES[2], values: at.map((m) => m.ndcg) },
        ]}
      />
    </>
  )
}

export default function RetrievalMetrics() {
  const state = useProjectData(loadCorpus)
  return (
    <Widget name="retrieval-metrics">
      <DataGate state={state}>
        {(corpus, project) => (
          <>
            <DataSource project={project} files={[corpus.file]}>
              The ranking and grades are illustrative judgements.
            </DataSource>
            <Ranking key={project.id} corpus={corpus} scenario={SCENARIOS[project.id]} />
          </>
        )}
      </DataGate>
    </Widget>
  )
}
