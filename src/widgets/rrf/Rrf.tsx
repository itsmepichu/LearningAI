import { useMemo, useState } from 'react'
import { rankIds } from '../bm25/engine'
import { loadCorpus } from '../bm25/corpus'
import { DataGate, DataSource, Slider, Widget, fmt, useProjectData } from '../kit'
import { COMPARE } from '../retriever-compare/scenarios'
import { fuse } from './fuse'

const TOP = 5

export default function Rrf() {
  const [k, setK] = useState(60)
  const state = useProjectData(loadCorpus)
  const lexical = useMemo(() => (state.data ? rankIds(state.data.docs, COMPARE[state.project.id].query, TOP) : []), [state.data, state.project.id])
  return (
    <Widget name="rrf">
      <DataGate state={state}>
        {(corpus, project) => {
          const s = COMPARE[project.id]
          const dense = s.dense.slice(0, TOP)
          const titles = new Map(corpus.docs.map((d) => [d.id, d.title]))
          const fused = fuse([lexical, dense], k)
          const both = new Set(fused.filter((f) => f.lists > 1).map((f) => f.id))
          const Item = ({ id }: { id: string }) => (both.has(id) ? <b>{titles.get(id) ?? id} · both</b> : <>{titles.get(id) ?? id}</>)
          return (
            <>
              <DataSource project={project} files={[corpus.file]}>
                BM25 and the fusion are computed live. The dense ranking is a fixed illustration.
              </DataSource>
              <p className="wk-q">
                <b>Query:</b> “{s.query}”
              </p>
              <div className="cols3 wk-cols">
                <div className="card">
                  <span className="wk-col-h">BM25 ranking</span>
                  <small>computed live</small>
                  <ol>
                    {lexical.map((id) => (
                      <li key={id}>
                        <Item id={id} />
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="card">
                  <span className="wk-col-h">Dense ranking</span>
                  <small>fixed illustration</small>
                  <ol>
                    {dense.map((id) => (
                      <li key={id}>
                        <Item id={id} />
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="card">
                  <span className="wk-col-h">RRF fused (k = {k})</span>
                  <small>computed live</small>
                  <ol>
                    {fused.map((f) => (
                      <li key={f.id}>
                        <Item id={f.id} /> <span className="wk-from">{fmt(f.score, 4)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              <Slider label="k" value={k} min={1} max={100} onChange={setK} />
            </>
          )
        }}
      </DataGate>
    </Widget>
  )
}
