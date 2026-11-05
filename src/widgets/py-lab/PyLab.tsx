import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { CallCancelled, DataGate, DataSource, DownloadGate, EventList, KpiRow, ScrollRegion, Widget, fmt, useGate, useProjectData, type Gate, type StepEvent } from '../kit'
import { pythonGate } from '../engines/gates'
import type { Project } from '../../data/projects'
import { LAB_IDS, loadLab, trimTraceback, type LabBundle, type LabCheck, type LabId } from './labs'

/** Well past any honest run of these labs, which take seconds. Past this it is probably an endless loop. */
const TIME_LIMIT_MS = 60_000

interface RunResult {
  error?: string
  checks?: LabCheck[]
  ms: number
}

interface Session {
  code: string
  setCode: (code: string) => void
  /** Why the last run stopped. It lives here so it outlasts the restart that stopping causes. */
  note: string | null
  setNote: (note: string | null) => void
}

function Lab({ lab, gate, project, session }: { lab: LabBundle; gate: Gate; project: Project; session: Session }) {
  const id = useId()
  const { code, setCode, setNote } = session
  const [variant, setVariant] = useState(-1)
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
    const files = variant < 0 ? lab.files : lab.variants![variant].files
    gate
      .call<RunResult>('run', { code, files, grader: lab.grader }, (e) => {
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
  const passed = result?.checks?.filter((c) => c.pass).length ?? 0
  const events: StepEvent[] = (result?.checks ?? []).map((c) => ({ status: c.pass ? 'Pass' : 'Not yet', tone: c.pass ? 'ok' : 'bad', title: c.name, detail: c.detail }))
  return (
    <>
      {lab.variants && (
        <div className="wk-chips">
          <span>Train on</span>
          <button type="button" className="wk-chip" aria-pressed={variant < 0} onClick={() => setVariant(-1)}>
            {project.company} text
          </button>
          {lab.variants.map((v, i) => (
            <button key={v.label} type="button" className="wk-chip" aria-pressed={variant === i} onClick={() => setVariant(i)}>
              {v.label}
            </button>
          ))}
        </div>
      )}
      <label htmlFor={id} className="wk-q-in">
        Python (edit it)
        <textarea id={id} className="wk-code" value={code} rows={18} spellCheck={false} autoComplete="off" wrap="off" onChange={(e) => setCode(e.target.value)} />
      </label>
      <div className="ctl">
        <button type="button" className="btn primary" disabled={running} onClick={run}>
          {running ? 'Running…' : 'Run and check'}
        </button>
        <button type="button" className="btn" disabled={!running} onClick={() => stop('Stopped. Python has restarted, and your code is unchanged.')}>
          Stop
        </button>
        <button type="button" className="btn" disabled={running || code === lab.starter} onClick={() => setCode(lab.starter)}>
          Reset the code
        </button>
        {lab.solution !== lab.starter && (
          <button type="button" className="btn" disabled={running || code === lab.solution} onClick={() => setCode(lab.solution)}>
            Show a solution
          </button>
        )}
      </div>
      {(out || result?.error) && (
        <ScrollRegion label="Program output" className="tw wk-output">
          <pre>
            {out}
            {result?.error && <span className="wk-output-e">{trimTraceback(result.error)}</span>}
          </pre>
        </ScrollRegion>
      )}
      {result?.error && <p role="status">Your code raised an error, so the checks did not run. The traceback is above.</p>}
      {result?.checks && (
        <>
          <KpiRow
            items={[
              { label: 'checks passed', value: `${passed} of ${result.checks.length}`, tone: passed === result.checks.length ? 'ok' : 'warn' },
              { label: 'to run, in WebAssembly on this device', value: `${fmt(result.ms / 1000, 2)} s` },
            ]}
          />
          <EventList events={events} />
        </>
      )}
      <p className="wk-hint">
        <b>What this shows.</b> {lab.proves} These checks run in your browser and are for your own practice: nothing is sent anywhere, and timings in WebAssembly are slower than native Python.{' '}
        <a href="https://numpy.org/doc/stable/" target="_blank" rel="noreferrer">
          NumPy documentation
        </a>
        .
      </p>
    </>
  )
}

/** Holds the reader's code above the gate, because stopping a run restarts Python and the gate shows its progress meanwhile. */
function LabSession({ bundle, project, gate }: { bundle: LabBundle; project: Project; gate: Gate }) {
  const state = useGate(gate)
  const [code, setCode] = useState(bundle.starter)
  const [note, setNote] = useState<string | null>(null)
  return (
    <>
      <DownloadGate gate={gate} state={state} offer="Run this lab in real Python, in your browser" without="You can also run it on a laptop with Python and NumPy.">
        <Lab lab={bundle} gate={gate} project={project} session={{ code, setCode, note, setNote }} />
      </DownloadGate>
      {note && <p role="status">{note}</p>}
    </>
  )
}

export default function PyLab({ lab = 'bigram' }: { lab?: LabId }) {
  const id = LAB_IDS.includes(lab) ? lab : 'bigram'
  const load = useMemo(() => loadLab(id), [id])
  const data = useProjectData(load)
  const gate = useMemo(pythonGate, [])
  return (
    <Widget name="py-lab">
      <DataGate state={data}>
        {(bundle, project) => (
          <>
            <DataSource project={project} files={bundle.sources} />
            <p className="wk-q">{bundle.brief}</p>
            <LabSession key={`${project.id}:${id}`} bundle={bundle} project={project} gate={gate} />
          </>
        )}
      </DataGate>
    </Widget>
  )
}
