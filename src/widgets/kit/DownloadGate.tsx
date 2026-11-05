import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Gate, formatBytes, hostsOf, totalBytes, type DownloadSpec, type GateEnv, type GateState, type WorkerLike } from './download'

const browserEnv = (): GateEnv => ({
  worker: typeof Worker !== 'undefined',
  wasm: typeof WebAssembly !== 'undefined',
})

function seenStore() {
  try {
    return localStorage
  } catch {
    return null
  }
}

const gates = new Map<string, Gate>()

/** The one gate for this download. It is shared across the page and kept across page changes, so a model stays loaded. */
export function gateFor(spec: DownloadSpec, open: () => WorkerLike): Gate {
  let gate = gates.get(spec.id)
  if (!gate) {
    gate = new Gate(spec, open, browserEnv(), seenStore())
    gates.set(spec.id, gate)
  }
  return gate
}

/** The gate's state. The gate only opens its worker after the reader says yes. */
export function useGate(gate: Gate): GateState {
  const state = useSyncExternalStore(gate.subscribe, gate.getState)
  useEffect(() => {
    gate.check()
  }, [gate])
  return state
}

/** A sentence for screen readers at each tenth, not at every chunk. */
function useCoarsePercent(percent: number | null): number | null {
  const [coarse, setCoarse] = useState<number | null>(null)
  const last = useRef<number | null>(null)
  useEffect(() => {
    const next = percent === null ? null : Math.floor(percent / 10) * 10
    if (next !== last.current) {
      last.current = next
      setCoarse(next)
    }
  }, [percent])
  return coarse
}

/**
 * The opt-in panel. It says what a download costs before it starts, then shows progress, failure and retry, or why this
 * browser cannot run it. `offer` says what the reader gets; `without` says what the figure does without it.
 * Once ready it renders `children`, or nothing.
 */
export function DownloadGate({ gate, state, offer, without, children }: { gate: Gate; state: GateState; offer: ReactNode; without: ReactNode; children?: ReactNode }) {
  const spec = gate.spec
  const size = formatBytes(totalBytes(spec))
  const coarse = useCoarsePercent(state.status === 'loading' ? state.percent : null)
  const docs = (
    <a href={spec.docs.href} target="_blank" rel="noreferrer">
      {spec.docs.label}
    </a>
  )
  if (state.status === 'checking') {
    return (
      <div className="wk-gate" data-gate="checking" role="status">
        Checking what this browser supports…
      </div>
    )
  }
  if (state.status === 'unsupported') {
    return (
      <div className="wk-gate" data-gate="unsupported">
        <b className="wk-gate-h">Not supported here</b>
        <p>
          {state.reason} Nothing was downloaded. {without}
        </p>
        <p>See {docs}.</p>
      </div>
    )
  }
  if (state.status === 'ready') {
    return children ? (
      <div className="wk-gate ready" data-gate="ready">
        {children}
      </div>
    ) : null
  }
  if (state.status === 'loading') {
    return (
      <div className="wk-gate" data-gate="loading">
        <b className="wk-gate-h">{state.stage ?? (state.file ? `Downloading ${state.file}` : 'Starting')}</b>
        <div className="wk-bar" role="progressbar" aria-label={`Downloading ${spec.what}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.percent}>
          <i style={{ width: `${state.percent}%` }} />
        </div>
        <div className="wk-gate-row">
          <span className="wk-gate-n">
            {formatBytes(state.loaded)} of {formatBytes(state.total)} ({state.percent}%)
          </span>
          <button type="button" className="btn" onClick={() => gate.cancel()}>
            Cancel
          </button>
        </div>
        <span className="wk-sr" role="status">
          {coarse === null ? '' : `Downloaded ${coarse}%`}
        </span>
      </div>
    )
  }
  const seen = state.seen
  const failed = state.status === 'failed'
  return (
    <div className={'wk-gate' + (failed ? ' bad' : '')} data-gate={failed ? 'failed' : 'idle'}>
      {failed ? (
        <div role="alert">
          <b className="wk-gate-h">The download did not finish</b>
          <p>
            {state.message} {without}
          </p>
        </div>
      ) : (
        <>
          <b className="wk-gate-h">{offer}</b>
          <p>
            {seen
              ? `This browser finished this download before, so it should load from its cache. If the cache was cleared, it downloads again: about ${size}.`
              : `Nothing has been downloaded. This needs about ${size} from ${hostsOf(spec).join(' and ')}, once; your browser then keeps it in its cache.`}{' '}
            {without}
          </p>
        </>
      )}
      <div className="wk-gate-row">
        <button type="button" className="btn primary" onClick={() => void gate.start()}>
          {failed ? 'Try again' : seen ? 'Load it' : `Download ${size}`}
        </button>
        <span className="wk-gate-n">{docs}</span>
      </div>
      <details className="wk-gate-files">
        <summary>What it downloads</summary>
        <ul>
          {spec.files.map((f) => (
            <li key={f.label}>
              {f.label}: {formatBytes(f.bytes)} from {f.host}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
