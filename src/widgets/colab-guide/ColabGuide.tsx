import { useCallback, useMemo, useState } from 'react'
import { DataGate, DataSource, ScrollRegion, Widget, useProjectData } from '../kit'
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { getGuide } from './guides'
import { COLAB_FAQ, COLAB_URL, notebookName, toNotebook, type GuideDef } from './notebook'

function CopyButton({ code, step }: { code: string; step: number }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setState('copied')
    } catch {
      // The clipboard can be blocked. The code stays selectable on the page.
      setState('failed')
    }
    setTimeout(() => setState('idle'), 2500)
  }
  return (
    <button type="button" className="btn" aria-label={`Copy the code for step ${step}`} onClick={() => void copy()}>
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select the code to copy it' : 'Copy'}
    </button>
  )
}

/** A step-by-step Google Colab guide. `guide` picks one from guides.ts; the default is the 5.6 decoding guide. */
export default function ColabGuide({ guide }: { guide?: string }) {
  const def = getGuide(guide)
  const load = useCallback((p: Project, read: DataReader) => def.load(p, read), [def])
  const data = useProjectData(load)
  return (
    <Widget name="colab-guide">
      <DataGate state={data}>
        {(seed, project) => <Guide key={`${def.id}-${project.id}`} def={def} seed={seed} project={project} />}
      </DataGate>
    </Widget>
  )
}

function Guide({ def, seed, project }: { def: GuideDef<unknown>; seed: unknown; project: Project }) {
  const steps = useMemo(() => def.steps(project, seed), [def, project, seed])
  const source = def.source?.(seed)
  const download = () => {
    const url = URL.createObjectURL(new Blob([toNotebook(def, def.neutral ? null : project, steps)], { type: 'application/x-ipynb+json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = notebookName(def, project.id)
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <>
      {source && (
        <DataSource project={project} files={source.files}>
          {source.note}
        </DataSource>
      )}
      <div className="ctl">
        <a className="btn primary" href={COLAB_URL} target="_blank" rel="noreferrer">
          Open Google Colab
        </a>
        <button type="button" className="btn" onClick={download}>
          Download the notebook
        </button>
      </div>
      <ol className="wk-guide">
        {steps.map((s, i) => (
          <li key={s.title}>
            <b>{s.title}</b>
            <p>{s.text}</p>
            {s.code && (
              <>
                <ScrollRegion label={`Code for step ${i + 1}`} className="tw wk-output">
                  <pre>
                    <code>{s.code}</code>
                  </pre>
                </ScrollRegion>
                <div className="ctl">
                  <CopyButton code={s.code} step={i + 1} />
                </div>
              </>
            )}
            {s.expect && (
              <p className="wk-hint">
                <b>You should see:</b> {s.expect}
              </p>
            )}
          </li>
        ))}
      </ol>
      <p className="wk-hint">
        <b>What this does and does not show.</b> {def.limits(project)} Nothing here runs on this site; the code runs on Google’s machines, under{' '}
        <a href={COLAB_FAQ} target="_blank" rel="noreferrer">
          Colab’s limits and terms
        </a>
        . Read{' '}
        {def.links.map((l, i) => (
          <span key={l.href}>
            {i > 0 && (i === def.links.length - 1 ? ' and ' : ', ')}
            <a href={l.href} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          </span>
        ))}{' '}
        too.
      </p>
    </>
  )
}
