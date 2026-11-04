import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ArrowRightLeft, Database, Download, FlaskConical, Lightbulb, TriangleAlert } from 'lucide-react'
import { fill, getProject, isProjectId, loadPractice, projects, datasetUrl, type ChapterPractice, type ProjectId, type TopicPractice } from '../data/projects'
import { useProgress } from '../store/progress'
import { ProjectIcon } from './ProjectPicker'

/** The project to show on this page: a `?project=` override for this visit, else the saved default. */
export function useActiveProject() {
  const saved = useProgress((s) => s.project)
  const [params, setParams] = useSearchParams()
  const q = params.get('project')
  const override = isProjectId(q) && q !== saved ? q : undefined
  const setOverride = (id: ProjectId | undefined) => {
    const next = new URLSearchParams(params)
    if (id && id !== saved) next.set('project', id)
    else next.delete('project')
    setParams(next, { replace: true, preventScrollReset: true })
  }
  return { project: (override ?? saved) as ProjectId, saved, override, setOverride }
}

export function useChapterPractice(chapterId: string | undefined) {
  const [data, setData] = useState<{ id: string; practice: ChapterPractice } | null>(null)
  useEffect(() => {
    if (!chapterId) return
    let live = true
    loadPractice(chapterId).then((practice) => live && setData({ id: chapterId, practice }))
    return () => {
      live = false
    }
  }, [chapterId])
  return data && data.id === chapterId ? data.practice : null
}

const Html = ({ html, className }: { html: string; className?: string }) => <div className={className} dangerouslySetInnerHTML={{ __html: html }} />

/** "In practice" block: one tab per example project, with the active project's note, failure, try-it steps and dataset. */
export function PracticeBlock({ practice }: { practice: TopicPractice | undefined }) {
  const { project, saved, setOverride } = useActiveProject()
  const setProject = useProgress((s) => s.setProject)
  const p = getProject(project)!
  const note = practice?.[project]

  return (
    <section className="pb" aria-label="In practice" style={{ ['--pc' as string]: `var(${p.accent})` }}>
      <div className="pb-tabs" role="tablist" aria-label="Example project">
        {projects.map((x) => {
          const has = !!practice?.[x.id]
          return (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={x.id === project}
              className={'pb-tab' + (x.id === project ? ' on' : '') + (has ? '' : ' empty')}
              style={{ ['--pc' as string]: `var(${x.accent})` }}
              onClick={() => setOverride(x.id)}
              title={has ? `${x.label} · ${x.company}` : `${x.label}: not written yet for this topic`}
            >
              <ProjectIcon id={x.id} size={14} />
              <span>{x.label}</span>
              {practice?.[x.id]?.fit === 'best' && <i className="pb-best" title="Best fit for this topic">★</i>}
            </button>
          )
        })}
      </div>
      {project !== saved && (
        <div className="pb-peek">
          You are viewing <b>{p.label}</b> for this topic only.
          <button type="button" className="linkish" onClick={() => { setProject(project); setOverride(undefined) }}>Make {p.label} my default</button>
          <button type="button" className="linkish" onClick={() => setOverride(undefined)}>Back to {getProject(saved)!.label}</button>
        </div>
      )}
      {note ? (
        <div className="pb-body" role="tabpanel">
          <div className="pb-row ip2">
            <b><Lightbulb size={15} /> In practice · {p.label} <small>({p.company})</small></b>
            <Html html={fill(note.practice, p)} />
          </div>
          <div className="pb-row fa3">
            <b><TriangleAlert size={15} /> Failure to avoid</b>
            <Html html={fill(note.failure, p)} />
          </div>
          {note.tryIt && (
            <div className="pb-row try">
              <b><FlaskConical size={15} /> Try it with {p.company} data</b>
              <Html html={fill(note.tryIt, p)} />
            </div>
          )}
          <DatasetLinks projectId={project} />
        </div>
      ) : (
        <div className="pb-body pb-empty" role="tabpanel">
          The {p.label} version of this topic's practical note has not been written yet.
          {practice?.harbor && project !== 'harbor' && (
            <button type="button" className="linkish" onClick={() => setOverride('harbor')}>Read the Harbor version</button>
          )}
        </div>
      )}
    </section>
  )
}

export function DatasetLinks({ projectId, full = false }: { projectId: ProjectId; full?: boolean }) {
  const p = getProject(projectId)!
  return (
    <div className={'ds' + (full ? ' full' : '')}>
      <span className="ds-h"><Database size={14} /> {p.company} dataset (synthetic)</span>
      {p.datasets.map((d) => (
        <a key={d.file} href={datasetUrl(p, d.file)} download className="ds-f" title={d.what + ' ' + d.notes}>
          <Download size={12} /> {d.file}
        </a>
      ))}
      {full && (
        <ul className="ds-list">
          {p.datasets.map((d) => (
            <li key={d.file}><code>{d.file}</code> {d.what} <span className="muted">{d.notes}</span></li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Small note at the end of a topic pointing to projects that suit it better (or also). */
export function ProjectFitNote({ practice }: { practice: TopicPractice | undefined }) {
  const { project, setOverride } = useActiveProject()
  const setProject = useProgress((s) => s.setProject)
  if (!practice) return null
  const rated = projects.filter((p) => practice[p.id]?.fit)
  if (!rated.length) return null
  const mine = practice[project]?.fit
  const better = rated.filter((p) => p.id !== project && (practice[p.id]!.fit === 'best' || (mine === 'limited' && practice[p.id]!.fit === 'good')))
  const others = projects.filter((p) => p.id !== project && practice[p.id])
  if (mine === 'limited' && better.length) {
    const top = better.sort((a, b) => (practice[a.id]!.fit === 'best' ? -1 : 0) - (practice[b.id]!.fit === 'best' ? -1 : 0))
    const first = top[0]
    return (
      <aside className="fitnote strong" aria-label="Other example projects">
        <ArrowRightLeft size={16} />
        <div>
          <p>
            <b>{getProject(project)!.label} has little to experiment with in this topic.</b>{' '}
            {top.map((p, i) => (
              <span key={p.id}>
                {i > 0 && (i === top.length - 1 ? ' and ' : ', ')}
                <b>{p.label}</b>
                {practice[p.id]!.fitNote ? ` (${fill(practice[p.id]!.fitNote, p)})` : ''}
              </span>
            ))}{' '}
            {top.length > 1 ? 'give' : 'gives'} you more to try.
          </p>
          <div className="fitnote-btns">
            <button type="button" className="btn sm primary" onClick={() => { setOverride(first.id); document.querySelector('.pb')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>
              Try this topic with {first.label}
            </button>
            <button type="button" className="btn sm" onClick={() => { setProject(first.id); setOverride(undefined) }}>
              Make {first.label} my default
            </button>
          </div>
        </div>
      </aside>
    )
  }
  if (!others.length) return null
  return (
    <aside className="fitnote" aria-label="Other example projects">
      <ArrowRightLeft size={15} />
      <p>
        Also explore this topic with{' '}
        {others.map((p, i) => (
          <span key={p.id}>
            {i > 0 && ' · '}
            <button type="button" className="linkish" onClick={() => { setOverride(p.id); document.querySelector('.pb')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>
              {p.label}
              {practice[p.id]?.fit === 'best' ? ' ★' : ''}
            </button>
          </span>
        ))}
      </p>
    </aside>
  )
}

/** Project-specific scenario for a chapter lab. */
export function LabVariant({ practice }: { practice: ChapterPractice | null }) {
  const { project, setOverride } = useActiveProject()
  const lab = practice?._lab
  if (!lab) return null
  const p = getProject(project)!
  const v = lab[project]
  return (
    <section className="labvar" style={{ ['--pc' as string]: `var(${p.accent})` }} aria-label="Lab with your example project">
      <header>
        <span className="pp-ico"><ProjectIcon id={project} /></span>
        <b>Do this lab with {p.label} <small>({p.company})</small></b>
        <span className="labvar-tabs">
          {projects.filter((x) => lab[x.id]).map((x) => (
            <button key={x.id} type="button" className={'lchip' + (x.id === project ? ' on' : '')} onClick={() => setOverride(x.id)}>{x.label}</button>
          ))}
        </span>
      </header>
      {v ? <Html className="labvar-b" html={fill(v.scenario, p)} /> : <p className="muted">No {p.label} scenario for this lab yet.</p>}
      <DatasetLinks projectId={project} />
    </section>
  )
}
