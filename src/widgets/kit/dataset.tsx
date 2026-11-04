import { useEffect, useState, type ReactNode } from 'react'
import { datasetUrl, type Project } from '../../data/projects'
import { parseCsv } from './csv'
import { useProject } from './hooks'

/** A failed load is forgotten, so Try again really tries again. */
const cache = new Map<string, Promise<unknown>>()
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  let hit = cache.get(key) as Promise<T> | undefined
  if (!hit) {
    hit = load().catch((e) => {
      cache.delete(key)
      throw e
    })
    cache.set(key, hit)
  }
  return hit
}

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url)
  // A static host answers a missing file with the app's HTML page and a 200.
  if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) throw new Error(`Could not load ${url}`)
  return res
}

/** A JSON dataset file of this project. */
export function loadJson<T>(project: Project, file: string): Promise<T> {
  const url = datasetUrl(project, file)
  return once(url, () => fetchOk(url).then((r) => r.json() as Promise<T>))
}

/** Reads only as much of the response as `rows` needs, so one example row does not download a 600 KB file. */
async function readHead(res: Response, rows: number): Promise<string> {
  if (!res.body) return res.text()
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let lines = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return text + decoder.decode()
      const part = decoder.decode(value, { stream: true })
      text += part
      lines += part.split('\n').length - 1
      if (lines > rows) return text.slice(0, text.lastIndexOf('\n') + 1)
    }
  } finally {
    reader.cancel().catch(() => undefined)
  }
}

/** A CSV dataset file of this project, or its first `rows` rows. */
export function loadCsv(project: Project, file: string, rows?: number): Promise<Record<string, string>[]> {
  const url = datasetUrl(project, file)
  return once(rows ? `${url}#head${rows}` : url, async () => {
    const res = await fetchOk(url)
    return parseCsv(rows ? await readHead(res, rows) : await res.text())
  })
}

export interface ProjectData<T> {
  project: Project
  /** Null while loading, after an error, and for a moment after the project changes. */
  data: T | null
  error: boolean
  retry: () => void
}

/**
 * Loads a widget's example data for the selected project, and again when the reader switches project.
 * `load` must be stable: define it at module level.
 */
export function useProjectData<T>(load: (p: Project) => Promise<T>): ProjectData<T> {
  const project = useProject()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ id: string; data?: T; error?: boolean } | null>(null)
  useEffect(() => {
    let live = true
    load(project).then(
      (data) => live && setState({ id: project.id, data }),
      (e) => {
        console.warn('widget data did not load', e)
        if (live) setState({ id: project.id, error: true })
      },
    )
    return () => {
      live = false
    }
  }, [project, attempt, load])
  const current = state && state.id === project.id ? state : null
  return { project, data: current?.data ?? null, error: !!current?.error, retry: () => setAttempt((n) => n + 1) }
}

/** Shows the wait or the failure, and renders its children only once the data has arrived. */
export function DataGate<T>({ state, children }: { state: ProjectData<T>; children: (data: T, project: Project) => ReactNode }) {
  if (state.error) {
    return (
      <div className="wk-state" role="alert">
        <span>Could not load the example data for {state.project.company}.</span>
        <button type="button" className="btn" onClick={state.retry}>
          Try again
        </button>
      </div>
    )
  }
  if (state.data === null) {
    return (
      <div className="wk-state" role="status">
        Loading the example data for {state.project.company}…
      </div>
    )
  }
  return <>{children(state.data, state.project)}</>
}

/** Says which project and dataset files the figure is showing, and links to them. */
export function DataSource({ project, files, children }: { project: Project; files: string[]; children?: ReactNode }) {
  return (
    <p className="wk-src">
      <span className="wk-src-co">{project.company}</span>
      {files.map((f) => (
        <a key={f} href={datasetUrl(project, f)} download>
          {f}
        </a>
      ))}
      {children && <span>{children}</span>}
    </p>
  )
}
