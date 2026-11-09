import { useEffect, useId, useMemo, useState } from 'react'
import { DataGate, DataSource, DownloadGate, ScrollRegion, Widget, fmt, useGate, useProjectData } from '../kit'
import { tokenizersGate } from '../engines/gates'
import { TOKENIZER_MODELS } from '../engines/specs'
import { LANGUAGE_NAMES, brokenPieces, loadTokenizerSamples, perLanguage, type Sample, type Tokenized } from './samples'

const SHOW = 48

function useTokenized(ready: boolean, texts: string[], call: <T>(op: string, args: unknown) => Promise<T>) {
  const [out, setOut] = useState<{ key: string; results: Tokenized[][] } | null>(null)
  const key = JSON.stringify(texts)
  useEffect(() => {
    if (!ready || !texts.length) return
    let live = true
    const timer = setTimeout(() => {
      call<Tokenized[][]>('tokenize', { texts }).then(
        (results) => {
          if (live) setOut({ key, results })
        },
        () => {
          // A stopped worker shows as the gate's own state.
        },
      )
    }, 150)
    return () => {
      live = false
      clearTimeout(timer)
    }
    // `key` stands for `texts`, which is a new array on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key, call])
  return out?.key === key ? out.results : null
}

function Compare({ samples, call }: { samples: Sample[]; call: <T>(op: string, args: unknown) => Promise<T> }) {
  const id = useId()
  const [text, setText] = useState(samples[0].text)
  useEffect(() => setText(samples[0].text), [samples])
  const all = useTokenized(true, useMemo(() => samples.map((s) => s.text), [samples]), call)
  const one = useTokenized(true, useMemo(() => (text.trim() ? [text] : []), [text]), call)
  const rows = useMemo(() => (all ? perLanguage(samples, all) : null), [all, samples])
  return (
    <>
      <div className="wk-chips">
        <span>Try</span>
        {samples.map((s) => (
          <button key={s.text} type="button" className="wk-chip" lang={s.language} aria-pressed={s.text === text} onClick={() => setText(s.text)}>
            {LANGUAGE_NAMES[s.language] ?? s.language}: {s.text.length > 26 ? [...s.text].slice(0, 24).join('') + '…' : s.text}
          </button>
        ))}
      </div>
      <label htmlFor={id} className="wk-q-in">
        Text (edit it)
        <textarea id={id} value={text} rows={2} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="wk-tokz">
        {TOKENIZER_MODELS.map((m, t) => {
          const r = one?.[t]?.[0]
          const broken = r ? brokenPieces(r) : 0
          return (
            <div key={m.id} className="wk-tokz-r" data-tokenizer={m.name}>
              <div className="wk-tokz-h">
                <b>{m.name}</b> <span>{m.algorithm}</span> <b className="wk-tokz-n">{r ? `${fmt(r.pieces.length)} tokens` : '…'}</b>
              </div>
              {r && (
                <div className="wk-word">
                  {r.pieces.slice(0, SHOW).map((p, i) => (
                    <span key={i} className={'wk-tok' + (p.includes('�') ? ' made' : '')}>
                      {p}
                    </span>
                  ))}
                  {r.pieces.length > SHOW && <span className="wk-gate-n">and {fmt(r.pieces.length - SHOW)} more</span>}
                </div>
              )}
              {broken > 0 && <p className="wk-hint">{fmt(broken)} tokens hold only part of a character, shown as �: this tokenizer works on bytes and learned little of this script.</p>}
            </div>
          )
        })}
      </div>
      {rows && (
        <ScrollRegion label="Mean tokens per message by language">
          <table>
            <thead>
              <tr>
                <th>Language</th>
                <th>Messages</th>
                <th>Mean characters</th>
                {TOKENIZER_MODELS.map((m) => (
                  <th key={m.id}>{m.name}, mean tokens</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.language}>
                  <td>{LANGUAGE_NAMES[r.language] ?? r.language}</td>
                  <td>{r.messages}</td>
                  <td>{fmt(r.meanChars, 1)}</td>
                  {r.meanTokens.map((n, i) => (
                    <td key={i}>{fmt(n, 1)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      )}
      <p className="wk-hint">
        <b>Real tokenizers, and limited.</b> These counts are exact for these three open tokenizers. They are not the count any hosted model will bill: ask its provider’s tokenizer. The messages differ between languages, so read down a column with care and across a row with more confidence. A few short messages show the direction of the gap, not its size on your traffic.{' '}
        <a href="https://huggingface.co/docs/transformers.js/api/tokenizers" target="_blank" rel="noreferrer">
          Tokenizer documentation
        </a>
        .
      </p>
    </>
  )
}

export default function TokenizerCompare() {
  const data = useProjectData(loadTokenizerSamples)
  const gate = useMemo(tokenizersGate, [])
  const state = useGate(gate)
  const call = useMemo(() => <T,>(op: string, args: unknown) => gate.call<T>(op, args), [gate])
  return (
    <Widget name="tokenizer-compare">
      <DataGate state={data}>
        {({ file, samples }, project) => (
          <>
            <DataSource project={project} files={[file]}>
              {state.status === 'ready' ? 'Three real tokenizers run on this device, in a worker.' : 'Nothing is tokenized until you choose.'}
            </DataSource>
            <DownloadGate gate={gate} state={state} offer="Compare three real tokenizers on these messages" without="The BPE figure above and the chart below work without it.">
              <Compare samples={samples} call={call} />
            </DownloadGate>
          </>
        )}
      </DataGate>
    </Widget>
  )
}
