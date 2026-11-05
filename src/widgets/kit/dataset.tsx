import { useEffect, useState, type ReactNode } from 'react'
import { datasetUrl, type Project } from '../../data/projects'
import { parseCsv, readCsvHead } from './csv'
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

/** How a widget's loader reads the selected project's dataset files. Tests pass one that reads from disk. */
export interface DataReader {
  json<T>(file: string): Promise<T>
  /** A CSV file, or only its first `rows` rows, which avoids downloading all of a large file. */
  csv(file: string, rows?: number): Promise<Record<string, string>[]>
  /** The file as it is, for handing to a program. */
  text(file: string): Promise<string>
}

function readerFor(project: Project): DataReader {
  return {
    json<T>(file: string) {
      const url = datasetUrl(project, file)
      return once(url, () => fetchOk(url).then((r) => r.json() as Promise<T>))
    },
    csv(file, rows) {
      const url = datasetUrl(project, file)
      return once(rows ? `${url}#head${rows}` : url, async () => {
        const res = await fetchOk(url)
        return rows ? readCsvHead(res, rows) : parseCsv(await res.text())
      })
    },
    text(file) {
      const url = datasetUrl(project, file)
      return once(`${url}#text`, () => fetchOk(url).then((r) => r.text()))
    },
  }
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
export function useProjectData<T>(load: (p: Project, read: DataReader) => Promise<T>): ProjectData<T> {
  const project = useProject()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ id: string; data?: T; error?: boolean } | null>(null)
  useEffect(() => {
    let live = true
    load(project, readerFor(project)).then(
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
