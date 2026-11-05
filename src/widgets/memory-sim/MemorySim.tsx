import { useState } from 'react'
import { DataGate, DataSource, ScrollRegion, Slider, Widget, fmt, useProjectData } from '../kit'
import { TURNS, loadScript } from './scripts'
import { contextTokens, factRow, inWindow, knownFacts, type Kept } from './strategies'

const CELL: Record<Kept, { text: string; className: string }> = {
  full: { text: '✓ kept', className: 'wk-yes' },
  gist: { text: '◐ gist only', className: 'wk-part' },
  lost: { text: '✗ lost', className: 'wk-no' },
}
const Cell = ({ kept }: { kept: Kept }) => <td className={CELL[kept].className}>{CELL[kept].text}</td>

export default function MemorySim() {
  const [question, setQuestion] = useState(20)
  const [k, setK] = useState(4)
  const state = useProjectData(loadScript)
  return (
    <Widget name="memory-sim">
      <DataGate state={state}>
        {({ file, turns, facts }, project) => {
          const known = knownFacts(facts, question)
          const cost = contextTokens(question, k)
          return (
            <>
              <DataSource project={project} files={[file]}>
                The conversation is scripted. Its reference comes from the dataset.
              </DataSource>
              <div className="row2">
                <Slider label="Question asked at turn" value={question} min={4} max={TURNS} onChange={setQuestion} />
                <Slider label="Window size (recent turns kept)" value={k} min={2} max={10} onChange={setK} />
              </div>
              <ScrollRegion label="The conversation so far" className="out wk-log">
                {turns.slice(0, question).map((t, i) => {
                  const n = i + 1
                  return (
                    <div key={n} className={n === question ? 'wk-log-q' : inWindow(n, question, k) ? 'wk-log-in' : 'wk-log-out'}>
                      <b>{n}</b> {t}
                      {n === question ? ' (the question)' : ''}
                    </div>
                  )
                })}
              </ScrollRegion>
              <ScrollRegion label="Which facts each strategy keeps">
                <table>
                  <thead>
                    <tr>
                      <th>Fact</th>
                      <th>Full history</th>
                      <th>Sliding window ({k})</th>
                      <th>Summary + window</th>
                      <th>Fact store + window</th>
                    </tr>
                  </thead>
                  <tbody>
                    {known.map((f) => {
                      const r = factRow(f, question, k)
                      return (
                        <tr key={f.name}>
                          <td>
                            {f.name} <span className="wk-from">(turn {f.turn})</span>
                          </td>
                          <Cell kept={r.fullHistory} />
                          <Cell kept={r.window} />
                          <Cell kept={r.summary} />
                          <Cell kept={r.store} />
                        </tr>
                      )
                    })}
                    {!known.length && (
                      <tr>
                        <td colSpan={5}>No facts stated yet.</td>
                      </tr>
                    )}
                    <tr>
                      <td>
                        <b>Approx. context tokens</b>
                      </td>
                      <td>{fmt(cost.fullHistory)}</td>
                      <td>{fmt(cost.window)}</td>
                      <td>{fmt(cost.summary)}</td>
                      <td>{fmt(cost.store)}</td>
                    </tr>
                  </tbody>
                </table>
              </ScrollRegion>
            </>
          )
        }}
      </DataGate>
    </Widget>
  )
}
