import { Suspense, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ArrowRight, Check, Database, FlaskConical, Lightbulb, ListChecks, TriangleAlert } from 'lucide-react'
import { getChapter, partOf } from '../data/course'
import { fill, getProject, projects, type ProjectId } from '../data/projects'
import { datasetFilesIn, hasWorkshop, workshopTasks, type WorkshopTask } from '../data/workshop'
import { DatasetLinks, useChapterPractice } from '../components/Practice'
import { ProjectIcon } from '../components/ProjectPicker'
import { HtmlContent } from '../components/HtmlContent'
import { onRovingKeyDown, useDocumentTitle, usePage } from '../components/common'
import { widgets } from '../widgets/registry'
import { useProgress } from '../store/progress'
import { NotFound } from './NotFound'

const DataExplorer = widgets['data-explorer']
const Html = ({ html, className }: { html: string; className?: string }) => <div className={className} dangerouslySetInnerHTML={{ __html: html }} />

/** Four choices, saved in this browser. The same state as the top bar's picker. */
function ProjectChoice() {
  const project = useProgress((s) => s.project)
  const setProject = useProgress((s) => s.setProject)
  return (
    <div className="ws-choice" role="radiogroup" aria-label="Example project" onKeyDown={onRovingKeyDown}>
      {projects.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={p.id === project}
          tabIndex={p.id === project ? 0 : -1}
          className={'ws-opt' + (p.id === project ? ' on' : '')}
          style={{ ['--pc' as string]: `var(${p.accent})` }}
          onClick={() => setProject(p.id)}
        >
          <span className="pp-ico"><ProjectIcon id={p.id} size={18} /></span>
          <b>{p.label} <small>{p.company}</small></b>
          <span>{p.teaches}</span>
        </button>
      ))}
    </div>
  )
}

function Task({ t, chapterId, chosen, onExplore }: { t: WorkshopTask; chapterId: string; chosen: ProjectId; onExplore: (file: string) => void }) {
  const p = getProject(t.project)!
  const c = getProject(chosen)!
  const files = datasetFilesIn(`${t.note.tryIt ?? ''} ${t.note.practice}`, t.project)
  const topicPath = `/${chapterId}/${t.topic.id}`
  return (
    <li id={t.topic.id} className="ws-task" style={{ ['--pc' as string]: `var(${p.accent})` }}>
      <h3>
        <span className="mono">{t.topic.tn}</span> <Link to={topicPath}>{t.topic.title}</Link>
      </h3>
      {t.instead === 'limited' && (
        <p className="ws-instead" role="note">
          {c.label} has little to try in this topic{t.own?.fitNote ? ` (${fill(t.own.fitNote, c)})` : ''}. This task uses <b>{p.label}</b> instead.
        </p>
      )}
      {t.instead === 'missing' && (
        <p className="ws-instead" role="note">
          There is no {c.label} note for this topic yet. This task uses <b>{p.label}</b> instead.
        </p>
      )}
      {t.note.tryIt ? (
        <div className="pb-row try">
          <b><FlaskConical size={15} /> Try it with {p.company} data</b>
          <Html html={fill(t.note.tryIt, p)} />
        </div>
      ) : (
        <p className="muted">This topic has no hands-on task for {p.label}; read the note below.</p>
      )}
      <p className="ws-links">
        <Link className="btn sm" to={t.figure}>
          {t.topic.live?.length ? `Open the figure with ${p.label} data` : `Open the topic with ${p.label} data`} <ArrowRight size={14} />
        </Link>
        {files.map((f) => (
          <button key={f} type="button" className="btn sm" onClick={() => onExplore(f)}>
            <Database size={14} /> Open <code>{f}</code> in the data explorer
          </button>
        ))}
      </p>
      <details className="ws-more">
        <summary>In practice and failure to avoid</summary>
        <div className="pb-row ip2">
          <b><Lightbulb size={15} /> In practice · {p.label}</b>
          <Html html={fill(t.note.practice, p)} />
        </div>
        <div className="pb-row fa3">
          <b><TriangleAlert size={15} /> Failure to avoid</b>
          <Html html={fill(t.note.failure, p)} />
        </div>
      </details>
    </li>
  )
}

export function WorkshopPage() {
  const { chapterId } = useParams()
  const ch = getChapter(chapterId)
  const loc = useLocation()
  const on = !!ch && hasWorkshop(ch.id)
  const lab = usePage(chapterId, '_lab', on && !!ch?.hasLab)
  const practice = useChapterPractice(on ? chapterId : undefined)
  const project = useProgress((s) => s.project)
  const done = useProgress((s) => !!(chapterId && s.workshopDone[chapterId]))
  const setDone = useProgress((s) => s.setWorkshopDone)
  const [explorerFile, setExplorerFile] = useState<string | undefined>()
  const [explorerOpen, setExplorerOpen] = useState(false)
  useDocumentTitle(ch ? `${ch.num} workshop: ${ch.title}` : 'Not found')

  const ready = on && practice !== null && (!ch?.hasLab || lab !== null)
  useEffect(() => {
    if (!ready) return
    if (loc.hash) document.getElementById(loc.hash.slice(1))?.scrollIntoView({ block: 'start' })
    else window.scrollTo({ top: 0 })
  }, [ready, loc.hash, chapterId])

  if (!ch || !on) return <NotFound />
  const part = partOf(ch)
  const p = getProject(project)!
  const tasks = workshopTasks(ch, practice, project)
  const scenario = practice?._lab?.[project]
  const explore = (file: string) => {
    setExplorerFile(file)
    setExplorerOpen(true)
    requestAnimationFrame(() => document.getElementById('explorer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="chapter-page workshop">
      <header className="c-head">
        <div className="c-num" aria-hidden="true">{ch.num}</div>
        <div className="c-titles">
          <span className="c-kicker">{part?.label} · {ch.kind === 'capstone' ? 'Capstone project' : `Chapter ${ch.num}`} · Workshop</span>
          <h1>Workshop: {ch.title}</h1>
        </div>
        <p className="c-lede">
          The lessons use one example project each. Here you choose the project and apply the chapter to it: {ch.hasLab ? 'the lab, then ' : ''}a hands-on task for each topic.{' '}
          <Link to={`/${ch.id}`}>Back to the chapter</Link>
        </p>
      </header>

      <h2 className="c-sec" id="project">Choose your example project</h2>
      <ProjectChoice />
      <p className="muted small ws-note">Saved in this browser. All companies, people and figures are fictional, and the data is synthetic.</p>

      {ch.hasLab && lab && (
        <div id="lab" className="c-lab">
          <h2 className="c-sec">The chapter lab</h2>
          <HtmlContent html={lab} className="lai-lab" legacy={false} />
          <section className="labvar" style={{ ['--pc' as string]: `var(${p.accent})` }} aria-label={`Lab with ${p.label}`}>
            <header>
              <span className="pp-ico"><ProjectIcon id={project} /></span>
              <b>Do this lab with {p.label} <small>({p.company})</small></b>
            </header>
            {scenario ? <Html className="labvar-b" html={fill(scenario.scenario, p)} /> : <p className="muted">There is no {p.label} scenario for this lab yet.</p>}
            <DatasetLinks projectId={project} full />
          </section>
        </div>
      )}

      <h2 className="c-sec" id="tasks">Tasks, topic by topic</h2>
      {practice === null ? (
        <div className="skeleton" aria-busy="true"><i /><i /><i /></div>
      ) : tasks.length === 0 ? (
        <p className="muted">This chapter has no hands-on tasks yet.</p>
      ) : (
        <ol className="ws-tasks">
          {tasks.map((t) => <Task key={t.topic.id} t={t} chapterId={ch.id} chosen={project} onExplore={explore} />)}
        </ol>
      )}

      <h2 className="c-sec" id="data">Look at the data</h2>
      <details
        id="explorer"
        className="ws-explorer"
        open={explorerOpen}
        onToggle={(e) => setExplorerOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>Data explorer: first rows, counts, one filter, a mean ({p.company})</summary>
        {explorerOpen && (
          <Suspense fallback={<div className="widget-loading">Loading the explorer…</div>}>
            <DataExplorer file={explorerFile} />
          </Suspense>
        )}
      </details>

      <h2 className="c-sec" id="evidence">Keep your evidence</h2>
      <div className="ws-evidence">
        <p>For each task you finish, keep three things: the number or output you got, the command or steps that produced it, and one line on what it does <b>not</b> show. A result on invented data shows how a method behaves; it does not show how it would behave on real traffic.</p>
        <div className="chdone2">
          <button type="button" className={'btn ' + (done ? '' : 'primary')} onClick={() => setDone(ch.id, !done)} aria-pressed={done}>
            <Check size={15} /> {done ? 'Workshop done' : 'Mark workshop done'}
          </button>
          <Link className="btn" to={`/${ch.id}/check`}><ListChecks size={15} /> Chapter check</Link>
        </div>
      </div>
    </div>
  )
}
