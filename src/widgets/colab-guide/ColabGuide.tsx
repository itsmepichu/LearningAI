import { useMemo, useState } from 'react'
import { DataGate, DataSource, ScrollRegion, Widget, useProjectData } from '../kit'
import type { Project } from '../../data/projects'
import { COLAB_FAQ, COLAB_URL, MODEL, MODEL_CARD, guideSteps, loadColabSeed, toNotebook, type ColabSeed } from './notebook'

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

export default function ColabGuide() {
  const data = useProjectData(loadColabSeed)
  return (
    <Widget name="colab-guide">
      <DataGate state={data}>
        {(seed, project) => <Guide key={project.id} seed={seed} project={project} />}
      </DataGate>
    </Widget>
  )
}

function Guide({ seed, project }: { seed: ColabSeed; project: Project }) {
  const steps = useMemo(() => guideSteps(project, seed), [project, seed])
  const download = () => {
    const url = URL.createObjectURL(new Blob([toNotebook(project, steps)], { type: 'application/x-ipynb+json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `decoding-on-a-gpu-${project.id}.ipynb`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <>
      <DataSource project={project} files={[seed.file]}>
        The code below uses this question and document ({seed.doc.id}).
      </DataSource>
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
        <b>What this does and does not show.</b> You will see how decoding settings change the output of a real model, and roughly what a GPU buys you on one prompt. It does not show that this model’s answers can be trusted, what serving it would cost, or how another GPU would perform: Colab’s hardware varies. {project.company} and its documents are invented. Nothing here runs on this site; the code runs on Google’s machines, under{' '}
        <a href={COLAB_FAQ} target="_blank" rel="noreferrer">
          Colab’s limits and terms
        </a>
        . Read the{' '}
        <a href={MODEL_CARD} target="_blank" rel="noreferrer">
          {MODEL} model card
        </a>{' '}
        too.
      </p>
    </>
  )
}
