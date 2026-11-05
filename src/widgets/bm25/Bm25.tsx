import { useId, useMemo, useState } from 'react'
import { DataGate, DataSource, KpiRow, ScrollRegion, Widget, fmt, useProjectData } from '../kit'
import { buildIndex, postings, search, tokenize } from './engine'
import { SUGGESTIONS, loadCorpus, type Corpus, type Suggestion } from './corpus'

const TOP = 8
const SHOW_POSTINGS = 6

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const set = new Set(terms)
  return (
    <>
      {text.split(/([\p{L}\p{M}\p{N}-]+)/u).map((part, i) => {
        const t = tokenize(part)[0]
        return t && set.has(t) ? <b key={i}>{part}</b> : part
      })}
    </>
  )
}

function Search({ corpus, suggestions }: { corpus: Corpus; suggestions: Suggestion[] }) {
  const id = useId()
  const [query, setQuery] = useState(suggestions[0].q)
  const index = useMemo(() => buildIndex(corpus.docs), [corpus])
  const hits = useMemo(() => search(index, query).filter((h) => h.score > 0), [index, query])
  const entries = useMemo(() => postings(index, query), [index, query])
  const hint = suggestions.find((s) => s.q === query)?.shows
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
      {hint && <p className="wk-hint">{hint}</p>}
      <KpiRow
        items={[
          { label: `${corpus.noun} indexed`, value: fmt(index.n) },
          { label: 'average length (tokens)', value: fmt(index.avgdl, 1) },
          { label: 'documents with a match', value: fmt(hits.length) },
        ]}
      />
      <ScrollRegion label="BM25 results">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Doc</th>
              <th>BM25</th>
              <th>Text (matched terms in bold)</th>
            </tr>
          </thead>
          <tbody>
            {hits.slice(0, TOP).map((h, r) => {
              const d = corpus.docs[h.index]
              return (
                <tr key={d.id}>
                  <td>{r + 1}</td>
                  <td>
                    <code>{d.id}</code>
                  </td>
                  <td>{fmt(h.score, 2)}</td>
                  <td className="wk-hit">
                    <Highlighted text={d.title} terms={h.matched} />
                    <small>
                      <Highlighted text={d.body} terms={h.matched} />
                    </small>
                  </td>
                </tr>
              )
            })}
            {!hits.length && (
              <tr className="wk-none">
                <td colSpan={4}>No document contains a query term, so keyword search returns nothing.</td>
              </tr>
            )}
            {hits.length > TOP && (
              <tr className="wk-none">
                <td colSpan={4}>…and {fmt(hits.length - TOP)} more with a lower score.</td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollRegion>
      <div className="out">
        {'Inverted index for the query terms (term → posting list):\n'}
        {entries.length
          ? entries
              .map((p) => {
                if (!p.df) return `${p.term.padEnd(10)} → (not in the index: no keyword match is possible)`
                const list = p.docs.slice(0, SHOW_POSTINGS).map((d) => `${corpus.docs[d.index].id}(tf=${d.tf})`)
                const more = p.docs.length > SHOW_POSTINGS ? `, +${p.docs.length - SHOW_POSTINGS} more` : ''
                return `${p.term.padEnd(10)} → ${list.join(', ')}${more}   df=${p.df}  idf=${fmt(p.idf, 2)}`
              })
              .join('\n')
          : '(empty query)'}
      </div>
    </>
  )
}

export default function Bm25() {
  const state = useProjectData(loadCorpus)
  return (
    <Widget name="bm25">
      <DataGate state={state}>
        {(corpus, project) => (
          <>
            <DataSource project={project} files={[corpus.file]} />
            {/* A new project brings new documents and queries, so the search starts afresh. */}
            <Search key={project.id} corpus={corpus} suggestions={SUGGESTIONS[project.id]} />
          </>
        )}
      </DataGate>
    </Widget>
  )
}
