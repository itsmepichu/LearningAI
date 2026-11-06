import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { CallCancelled, DataGate, DataSource, DownloadGate, ScrollRegion, Widget, fmt, useGate, useProjectData, type Gate } from '../kit'
import { pythonGate } from '../engines/gates'
import { trimTraceback } from '../py-lab/labs'
import { SNIPPET_IDS, SNIPPETS, type Snippet, type SnippetBundle, type SnippetId } from './snippets'

const TIME_LIMIT_MS = 60_000
/** The worker runs a grader after the code; a snippet has nothing to grade. */
const NO_GRADER = '__result__ = "[]"'

interface RunResult {
  error?: string
  ms: number
}

interface Session {
  code: string
  setCode: (code: string) => void
  note: string | null
  setNote: (note: string | null) => void
}

function Runner({ bundle, gate, session }: { bundle: SnippetBundle; gate: Gate; session: Session }) {
  const id = useId()
  const { code, setCode, setNote } = session
  const [out, setOut] = useState('')
  const [result, setResult] = useState<RunResult | null>(null)
  const [running, setRunning] = useState(false)
  const runNo = useRef(0)
  const stop = useCallback(
    (why: string) => {
      runNo.current++
      setRunning(false)
      setNote(why)
      void gate.restart()
    },
    [gate, setNote],
  )
  useEffect(() => {
    if (!running) return
    const timer = setTimeout(() => stop(`Stopped after ${TIME_LIMIT_MS / 1000} seconds. Look for a loop that never ends.`), TIME_LIMIT_MS)
    return () => clearTimeout(timer)
  }, [running, stop])
  const run = () => {
    const mine = ++runNo.current
    setRunning(true)
    setOut('')
    setResult(null)
    setNote(null)
    gate
      .call<RunResult>('run', { code, files: bundle.files, grader: NO_GRADER }, (e) => {
        const text = (e as { out?: string }).out
        if (text && mine === runNo.current) setOut((o) => o + text)
      })
      .then(
        (r) => {
          if (mine === runNo.current) setResult(r)
        },
        (e) => {
          if (mine === runNo.current && !(e instanceof CallCancelled)) setNote(`The Python worker stopped: ${e instanceof Error ? e.message : String(e)}`)
        },
      )
      .finally(() => {
        if (mine === runNo.current) setRunning(false)
      })
  }
  const rows = Math.min(24, code.split('\n').length + 1)
  return (
    <>
      <label htmlFor={id} className="wk-q-in">
        Python (edit it and run it again)
        <textarea id={id} className="wk-code" value={code} rows={rows} spellCheck={false} autoComplete="off" wrap="off" onChange={(e) => setCode(e.target.value)} />
      </label>
      <div className="ctl">
        <button type="button" className="btn primary" disabled={running} onClick={run}>
          {running ? 'Running…' : 'Run'}
        </button>
        <button type="button" className="btn" disabled={!running} onClick={() => stop('Stopped. Python has restarted, and your code is unchanged.')}>
          Stop
        </button>
        <button type="button" className="btn" disabled={running || code === bundle.code} onClick={() => setCode(bundle.code)}>
          Reset the code
        </button>
        {result && !result.error && <span className="count">ran in {fmt(result.ms / 1000, 2)} s</span>}
      </div>
      {(out || result?.error) && (
        <ScrollRegion label="Program output" className="tw wk-output">
          <pre>
            {out}
            {result?.error && <span className="wk-output-e">{trimTraceback(result.error)}</span>}
          </pre>
        </ScrollRegion>
      )}
    </>
  )
}

/** Holds the reader's code above the gate, because stopping a run restarts Python. */
function SnippetSession({ bundle, gate }: { bundle: SnippetBundle; gate: Gate }) {
  const state = useGate(gate)
  const [code, setCode] = useState(bundle.code)
  const [note, setNote] = useState<string | null>(null)
  return (
    <>
      <DownloadGate gate={gate} state={state} offer="Run this code in real Python, in your browser" without="You can also copy it and run it on a laptop with Python 3 and NumPy.">
        <Runner bundle={bundle} gate={gate} session={{ code, setCode, note, setNote }} />
      </DownloadGate>
      {note && <p role="status">{note}</p>}
    </>
  )
}

export default function PySnippet({ snippet = 'attention' }: { snippet?: SnippetId }) {
  const id = SNIPPET_IDS.includes(snippet) ? snippet : 'attention'
  const def: Snippet = SNIPPETS[id]
  const data = useProjectData(def.build)
  const gate = useMemo(pythonGate, [])
  return (
    <Widget name="py-snippet">
      <DataGate state={data}>
        {(bundle, project) => (
          <>
            {bundle.sources.length > 0 && <DataSource project={project} files={bundle.sources} />}
            <p className="wk-q">
              <b>{def.title}.</b> {def.brief}
            </p>
            <SnippetSession key={`${def.neutral ? '' : project.id}:${id}`} bundle={bundle} gate={gate} />
            <p className="wk-hint">
              <b>What this shows.</b> {def.proves} It runs in your browser; nothing is sent anywhere.
            </p>
          </>
        )}
      </DataGate>
    </Widget>
  )
}
