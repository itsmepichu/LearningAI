/**
 * The opt-in download gate, without React: what a download costs, what the browser must support, and the state of
 * one worker that holds a heavy runtime. Nothing here starts a download by itself; only `start()` does.
 */
export type Need = 'worker' | 'wasm' | 'webgpu'

export interface DownloadFile {
  /** What this file is, in words. */
  label: string
  /** The size the reader's connection will carry: compressed where the host compresses it. */
  bytes: number
  host: string
}

export interface DownloadSpec {
  /** Stable name. It also names the worker, and with `version` the "already downloaded" note. */
  id: string
  /** Change it when the files change, so an old note is not trusted. */
  version: string
  /** What the reader gets, in a few words: "the all-MiniLM-L6-v2 embedding model". */
  what: string
  files: DownloadFile[]
  needs: Need[]
  /** The official documentation for this runtime or model. */
  docs: { label: string; href: string }
  /** The message that makes the worker load everything. */
  load: { op: string; args?: unknown }
}

export const totalBytes = (spec: Pick<DownloadSpec, 'files'>) => spec.files.reduce((sum, f) => sum + f.bytes, 0)
export const hostsOf = (spec: Pick<DownloadSpec, 'files'>) => [...new Set(spec.files.map((f) => f.host))]

/** 23,000,000 -> "23 MB", 1,500,000 -> "1.5 MB", 700,000 -> "0.7 MB". Download sizes use decimal units. */
export function formatBytes(bytes: number): string {
  const n = Math.max(0, bytes)
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`
  const mb = n / 1e6
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`
}

/** What a browser offers. Tests pass their own. */
export interface GateEnv {
  worker: boolean
  wasm: boolean
  /** False when WebGPU is missing, or the device has no adapter it will use. */
  gpu: () => Promise<boolean>
}

const NEED_WORDS: Record<Need, string> = {
  worker: 'Web Workers, which keep this work off the main thread',
  wasm: 'WebAssembly, which runs the runtime',
  webgpu: 'WebGPU with a usable graphics adapter, which runs the model on your GPU',
}

/** Why this browser cannot run the spec, in a sentence, or null when it can. */
export async function unsupportedReason(needs: Need[], env: GateEnv): Promise<string | null> {
  const missing: Need[] = []
  if (needs.includes('worker') && !env.worker) missing.push('worker')
  if (needs.includes('wasm') && !env.wasm) missing.push('wasm')
  if (needs.includes('webgpu') && !(await env.gpu().catch(() => false))) missing.push('webgpu')
  return missing.length ? `This browser does not offer ${missing.map((m) => NEED_WORDS[m]).join(', or ')}.` : null
}

export interface ProgressEvent {
  /** Which file this is about. An event without one only changes the wording. */
  file?: string
  loaded?: number
  total?: number
  /** Words for what is happening now, such as "Starting the runtime". */
  stage?: string
}

/**
 * Bytes so far, across files that report on their own. The denominator is the larger of the published estimate and
 * what the files have declared, so the bar never runs backwards when a new file starts and percent never passes 100.
 */
export class ProgressTally {
  private files = new Map<string, { loaded: number; total: number }>()
  private expected: number
  constructor(expected: number) {
    this.expected = expected
  }
  add(e: ProgressEvent): { loaded: number; total: number; percent: number } {
    if (e.file) {
      const was = this.files.get(e.file) ?? { loaded: 0, total: 0 }
      this.files.set(e.file, {
        loaded: Math.max(was.loaded, e.loaded ?? 0),
        total: Math.max(was.total, e.total ?? 0, e.loaded ?? 0),
      })
    }
    let loaded = 0
    let declared = 0
    for (const f of this.files.values()) {
      loaded += f.loaded
      declared += f.total
    }
    const total = Math.max(this.expected, declared)
    return { loaded, total, percent: total ? Math.min(100, Math.floor((loaded / total) * 100)) : 0 }
  }
}

export type GateState =
  | { status: 'checking' }
  | { status: 'unsupported'; reason: string }
  /** `seen`: this browser finished this download before, so it should come from the cache. */
  | { status: 'idle'; seen: boolean }
  | { status: 'loading'; loaded: number; total: number; percent: number; file?: string; stage?: string }
  | { status: 'ready'; fromCache: boolean; info?: unknown }
  | { status: 'failed'; message: string; seen: boolean }

/** The small part of `Worker` the gate uses. A test or an e2e stub provides the same. */
export interface WorkerLike {
  postMessage(message: unknown): void
  terminate(): void
  onmessage: ((e: { data: unknown }) => void) | null
  onerror: ((e: { message?: string; preventDefault?: () => void }) => void) | null
}

export interface WorkerReply {
  id: number
  type: 'progress' | 'result' | 'error'
  /** A ProgressEvent while loading, or whatever a running call reports, such as a generated token. */
  progress?: unknown
  result?: unknown
  message?: string
}

/** Where the "finished this download before" note lives. Tests pass a plain object. */
export interface SeenStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface Pending {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  onEvent?: (e: unknown) => void
}

/** Stopped by the reader, or the worker was replaced. Callers should not show this as a failure. */
export class CallCancelled extends Error {
  constructor() {
    super('cancelled')
    this.name = 'CallCancelled'
  }
}

/** One heavy worker and its gate. Components share it, and it outlives a page change, so a model stays loaded. */
export class Gate {
  private state: GateState = { status: 'checking' }
  private listeners = new Set<() => void>()
  private worker: WorkerLike | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1
  private checked = false
  private readonly seenKey: string
  readonly spec: DownloadSpec
  private open: () => WorkerLike
  private env: GateEnv
  private seen: SeenStore | null

  constructor(spec: DownloadSpec, open: () => WorkerLike, env: GateEnv, seen: SeenStore | null) {
    this.spec = spec
    this.open = open
    this.env = env
    this.seen = seen
    this.seenKey = `lai-download-${spec.id}-${spec.version}`
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  getState = () => this.state
  private set(next: GateState) {
    this.state = next
    this.listeners.forEach((fn) => fn())
  }

  private wasSeen(): boolean {
    try {
      return this.seen?.getItem(this.seenKey) === '1'
    } catch {
      return false
    }
  }

  /** Reads what the browser supports. It downloads nothing. */
  async check(): Promise<void> {
    if (this.checked) return
    this.checked = true
    const reason = await unsupportedReason(this.spec.needs, this.env)
    this.set(reason ? { status: 'unsupported', reason } : { status: 'idle', seen: this.wasSeen() })
  }

  private spawn() {
    const w = this.open()
    w.onmessage = (e) => this.onReply(e.data as WorkerReply)
    w.onerror = (e) => {
      e.preventDefault?.()
      this.failAll(new Error(e.message || 'The worker stopped unexpectedly.'))
    }
    this.worker = w
  }

  private onReply(r: WorkerReply) {
    const call = this.pending.get(r.id)
    if (!call) return
    if (r.type === 'progress') {
      call.onEvent?.(r.progress)
      return
    }
    this.pending.delete(r.id)
    if (r.type === 'result') call.resolve(r.result)
    else call.reject(new Error(r.message || 'The worker reported an error.'))
  }

  private failAll(e: Error) {
    const calls = [...this.pending.values()]
    this.pending.clear()
    calls.forEach((c) => c.reject(e))
  }

  private stopWorker(reason: Error) {
    this.worker?.terminate()
    this.worker = null
    this.failAll(reason)
  }

  private send<T>(op: string, args: unknown, onEvent?: (e: unknown) => void): Promise<T> {
    const w = this.worker
    if (!w) return Promise.reject(new Error('Nothing is loaded yet.'))
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onEvent })
      w.postMessage({ id, op, args })
    })
  }

  /** The reader's yes: start the worker and load everything, with progress. Also the retry after a failure. */
  async start(): Promise<void> {
    const { status } = this.state
    if (status === 'loading' || status === 'ready' || status === 'unsupported' || status === 'checking') return
    const seen = this.wasSeen()
    const tally = new ProgressTally(totalBytes(this.spec))
    let latest = tally.add({})
    let file: string | undefined
    let stage: string | undefined
    const paint = () => this.set({ status: 'loading', ...latest, file, stage })
    paint()
    try {
      this.spawn()
      const info = await this.send<unknown>(this.spec.load.op, this.spec.load.args, (e) => {
        const p = (e ?? {}) as ProgressEvent
        latest = tally.add(p)
        if (p.file) file = p.file
        stage = p.stage
        paint()
      })
      try {
        this.seen?.setItem(this.seenKey, '1')
      } catch {
        // Storage may be blocked. The note only changes the wording next time.
      }
      this.set({ status: 'ready', fromCache: seen, info })
    } catch (e) {
      this.worker?.terminate()
      this.worker = null
      if (e instanceof CallCancelled) return
      console.warn(`download ${this.spec.id} failed`, e)
      this.set({ status: 'failed', message: e instanceof Error ? e.message : String(e), seen })
    }
  }

  /** Stops a download in progress and returns to the offer. */
  cancel(): void {
    if (this.state.status !== 'loading') return
    this.stopWorker(new CallCancelled())
    this.set({ status: 'idle', seen: this.wasSeen() })
  }

  /** Asks the loaded worker to do something. `onEvent` hears anything it reports along the way. */
  call<T>(op: string, args?: unknown, onEvent?: (e: unknown) => void): Promise<T> {
    if (this.state.status !== 'ready') return Promise.reject(new Error('Nothing is loaded yet.'))
    return this.send<T>(op, args, onEvent)
  }

  /** Ends a running call the only way that always works, by ending the worker, then loads again (from the cache). */
  async restart(): Promise<void> {
    this.stopWorker(new CallCancelled())
    this.set({ status: 'idle', seen: this.wasSeen() })
    await this.start()
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Handler = (args: any, emit: (event: unknown) => void) => unknown

/** The worker side of the protocol: routes each message to a handler, and reports progress, results and errors. */
export function serve(scope: { postMessage(m: unknown): void; onmessage: ((e: { data: unknown }) => void) | null }, handlers: Record<string, Handler>): void {
  scope.onmessage = async (e) => {
    const { id, op, args } = e.data as { id: number; op: string; args: unknown }
    const emit = (event: unknown) => scope.postMessage({ id, type: 'progress', progress: event })
    try {
      const handler = handlers[op]
      if (!handler) throw new Error(`Unknown operation: ${op}`)
      scope.postMessage({ id, type: 'result', result: await handler(args, emit) })
    } catch (err) {
      scope.postMessage({ id, type: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }
}
