import { useId, useMemo, useState } from 'react'
import { DataGate, DataSource, Widget, fmt, useProjectData } from '../kit'
import { CLASSIC_TEXT, bpeStats, loadBpeText, trainBpe } from './merges'

const BATCH = 12

export default function Bpe() {
  const id = useId()
  const [text, setText] = useState(CLASSIC_TEXT)
  const [steps, setSteps] = useState(0)
  const state = useMemo(() => trainBpe(text, steps), [text, steps])
  const { vocabulary, tokens } = bpeStats(state)
  const data = useProjectData(loadBpeText)
  const use = (next: string) => {
    setText(next)
    setSteps(0)
  }
  const made = new Set(state.merges)
  return (
    <Widget name="bpe">
      <label htmlFor={id} className="wk-q-in">
        Training text (edit it)
        <textarea id={id} value={text} onChange={(e) => use(e.target.value)} />
      </label>
      <DataGate state={data}>
        {({ file, text: sample }, project) => (
          <>
            <div className="wk-chips">
              <span>Train on</span>
              <button type="button" className="wk-chip" aria-pressed={text === CLASSIC_TEXT} onClick={() => use(CLASSIC_TEXT)}>
                The classic example
              </button>
              <button type="button" className="wk-chip" aria-pressed={text === sample} onClick={() => use(sample)}>
                {project.company} text
              </button>
            </div>
            <DataSource project={project} files={[file]} />
          </>
        )}
      </DataGate>
      <div className="ctl">
        <button type="button" className="btn primary" disabled={state.finished} onClick={() => setSteps(state.merges.length + 1)}>
          Apply next merge
        </button>
        <button type="button" className="btn" disabled={state.finished} onClick={() => setSteps(state.merges.length + BATCH)}>
          Run {BATCH} merges
        </button>
        <button type="button" className="btn" disabled={steps === 0} onClick={() => setSteps(0)}>
          Reset
        </button>
        <span className="count" aria-live="polite">
          {state.merges.length} merges · {fmt(vocabulary)} distinct tokens in use · text = {fmt(tokens)} tokens
        </span>
      </div>
      <div className="out wk-one-line">
        {state.finished
          ? 'No pair occurs more than once, so merging stops.'
          : state.last
            ? `Merge ${state.merges.length}: "${state.last.left}" + "${state.last.right}" → "${state.last.merged}" (pair seen ${state.last.seen} times)`
            : 'Initial state: every word is split into single characters.'}
      </div>
      <div className="wk-words">
        {state.words.map((w, i) => (
          <span className="wk-word" key={i}>
            {w.symbols.map((s, j) => (
              <span key={j} className={'wk-tok' + (made.has(s) ? ' made' : '')}>
                {s}
              </span>
            ))}
            <span className="wk-from">×{w.count}</span>
          </span>
        ))}
      </div>
    </Widget>
  )
}
