/**
 * Runs Pyodide off the main thread, so a slow or endless Python program cannot freeze the page: the gate ends this
 * worker to stop it. Pyodide comes from a pinned CDN URL when this worker starts, after the reader opts in.
 */
import { serve } from '../kit/download.ts'
import { PYODIDE_FILES, PYODIDE_URL } from './specs.ts'

/* eslint-disable @typescript-eslint/no-explicit-any */
let py: any = null
let write: (text: string) => void = () => {}

export interface RunRequest {
  code: string
  files: Record<string, string>
  grader: string
}

serve(self as unknown as Parameters<typeof serve>[0], {
  async loadPython(_: unknown, emit) {
    // Fetched first so the bar can move. These are immutable on the CDN, so Pyodide's own requests hit the HTTP cache.
    for (const f of PYODIDE_FILES) {
      emit({ stage: `Downloading ${f.label}` })
      const res = await fetch(PYODIDE_URL + f.name)
      if (!res.ok) throw new Error(`Could not download ${f.name} (HTTP ${res.status}).`)
      await res.arrayBuffer()
      emit({ file: f.name, loaded: f.bytes, total: f.bytes, stage: `Downloaded ${f.label}` })
    }
    emit({ stage: 'Starting Python' })
    const { loadPyodide } = (await import(/* @vite-ignore */ PYODIDE_URL + 'pyodide.mjs')) as any
    py = await loadPyodide({ indexURL: PYODIDE_URL })
    await py.loadPackage('numpy', { messageCallback: () => {} })
    py.setStdout({ batched: (text: string) => write(text + '\n') })
    py.setStderr({ batched: (text: string) => write(text + '\n') })
    return { python: py.runPython('import sys; sys.version.split()[0]'), numpy: py.runPython('import numpy; numpy.__version__') }
  },

  /** One run in a fresh namespace. A Python error is a result to show, not a failure of the worker. */
  async run({ code, files, grader }: RunRequest, emit) {
    write = (text) => emit({ out: text })
    for (const [name, text] of Object.entries(files)) py.FS.writeFile(name, text)
    const ns = py.runPython('dict()')
    const start = performance.now()
    try {
      await py.runPythonAsync(code, { globals: ns, filename: 'lab.py' })
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e), ms: performance.now() - start }
    }
    const ms = performance.now() - start
    py.runPython(grader, { globals: ns })
    const checks = JSON.parse(ns.get('__result__'))
    ns.destroy()
    return { checks, ms }
  },
})
