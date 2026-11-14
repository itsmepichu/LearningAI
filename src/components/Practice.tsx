import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { ArrowRight, Database, Download, FlaskConical, Lightbulb, TriangleAlert } from 'lucide-react'
import { fill, getProject, isProjectId, loadPractice, projects, datasetUrl, type ChapterPractice, type ProjectId, type TopicPractice } from '../data/projects'
import { hasWorkshop, lessonTopicAt, primaryProject, workshopPath } from '../data/workshop'
import { useProgress } from '../store/progress'
import { ProjectIcon } from './ProjectPicker'

/**
 * The project to show on this page. A lesson (a topic page) uses the topic's primary project; every other page uses the reader's
 * saved workshop project. A `?project=` in the address overrides either for this visit: that is how a workshop task opens a figure.
 */
export function useActiveProject() {
  const saved = useProgress((s) => s.project)
  const { pathname } = useLocation()
  const lesson = lessonTopicAt(pathname)
  const base: ProjectId = lesson ? primaryProject(lesson.id) : saved
  const [params, setParams] = useSearchParams()
  const q = params.get('project')
  const override = isProjectId(q) && q !== base ? q : undefined
  const setOverride = (id: ProjectId | undefined) => {
    const next = new URLSearchParams(params)
    if (id && id !== base) next.set('project', id)
    else next.delete('project')
    setParams(next, { replace: true, preventScrollReset: true })
  }
  return { project: (override ?? base) as ProjectId, saved, base, lesson: !!lesson, override, setOverride }
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

/** Says which project frames the questions on pages where the top bar's picker controls it. */
export function ProjectFramingNote() {
  const { project } = useActiveProject()
  return (
    <span className="muted small">
      Questions framed for <b>{getProject(project)!.label}</b>. Change the example in the top bar.
    </span>
  )
}

const Html = ({ html, className }: { html: string; className?: string }) => <div className={className} dangerouslySetInnerHTML={{ __html: html }} />

/** The topic page's one card: the primary project's In practice, Failure to avoid and Try it, and the way to the workshop. */
export function PracticeBlock({ practice, chapterId, topicId }: { practice: TopicPractice | undefined; chapterId: string; topicId: string }) {
  const { base } = useActiveProject()
  // The primary project always has a note; if a topic has none for it, show the first project that does.
  const shown: ProjectId | undefined = practice?.[base] ? base : projects.find((x) => practice?.[x.id])?.id
  if (!shown) return null
  const p = getProject(shown)!
  const note = practice![shown]!
  return (
    <section className="pb" aria-label="In practice" style={{ ['--pc' as string]: `var(${p.accent})` }}>
      <header className="pb-head">
        <span className="pp-ico"><ProjectIcon id={shown} /></span>
        <b>Example project: {p.label}</b>
        <small>{p.company} · {p.kind}</small>
      </header>
      <div className="pb-body">
        <div className="pb-row ip2">
          <b><Lightbulb size={15} /> In practice</b>
          <Html html={fill(note.practice, p)} />
        </div>
        <div className="pb-row fa3">
          <b><TriangleAlert size={15} /> Failure to avoid</b>
          <Html html={fill(note.failure, p)} />
        </div>
        {note.tryIt && (
          <div className="pb-row try">
            <b><FlaskConical size={15} /> Try it</b>
            <Html html={fill(note.tryIt, p)} />
          </div>
        )}
        {hasWorkshop(chapterId) && (
          <p className="pb-more">
            <Link className="btn sm" to={workshopPath(chapterId, topicId)}>
              Do the chapter workshop <ArrowRight size={14} />
            </Link>
            <span className="muted small">Run this on any of the four example projects.</span>
          </p>
        )}
      </div>
    </section>
  )
}

/** One line on a topic page opened with `?project=`: the figures use that project's data. */
export function ExampleDataBanner({ chapterId, topicId }: { chapterId: string; topicId: string }) {
  const { override, setOverride } = useActiveProject()
  if (!override) return null
  const p = getProject(override)!
  return (
    <p className="pb-peek" role="note">
      Example data: <b>{p.label}</b> ({p.company}).
      {hasWorkshop(chapterId) && <Link to={workshopPath(chapterId, topicId)}>Back to the workshop</Link>}
      <button type="button" className="linkish" onClick={() => setOverride(undefined)}>Use this topic's own example</button>
    </p>
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

/** The saved project's scenario for a chapter lab, for chapters whose lab is still on the chapter page. */
export function LabScenario({ practice }: { practice: ChapterPractice | null }) {
  const project = useProgress((s) => s.project)
  const p = getProject(project)!
  const v = practice?._lab?.[project]
  if (!v) return null
  return (
    <section className="labvar" style={{ ['--pc' as string]: `var(${p.accent})` }} aria-label="Lab with your example project">
      <header>
        <span className="pp-ico"><ProjectIcon id={project} /></span>
        <b>Do this lab with {p.label} <small>({p.company})</small></b>
      </header>
      <Html className="labvar-b" html={fill(v.scenario, p)} />
      <DatasetLinks projectId={project} />
    </section>
  )
}
