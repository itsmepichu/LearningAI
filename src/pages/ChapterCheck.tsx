import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { motion } from 'motion/react'
import { ArrowLeft, Dumbbell, ListChecks } from 'lucide-react'
import { chapterCheckCount, getChapter, partOf, sectionCheckCount } from '../data/course'
import { loadChecks, type ChapterChecks } from '../data/checks'
import { CheckSection, sectionScore, visibleInterview, type Mode } from '../components/Checks'
import { ProjectFramingNote, useActiveProject } from '../components/Practice'
import { onRovingKeyDown, useDocumentTitle } from '../components/common'
import { useProgress } from '../store/progress'
import { NotFound } from './NotFound'

export function ChapterCheckPage() {
  const { chapterId } = useParams()
  const ch = getChapter(chapterId)
  const loc = useLocation()
  const [checks, setChecks] = useState<ChapterChecks | null>(null)
  const [mode, setMode] = useState<Mode>('practice')
  const [allProjects, setAllProjects] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const { project } = useActiveProject()
  const answers = useProgress((s) => s.answers)
  const ratings = useProgress((s) => s.ratings)
  useDocumentTitle(ch ? `Chapter ${ch.num} check` : 'Not found')

  useEffect(() => {
    if (!chapterId) return
    let live = true
    setChecks(null)
    loadChecks(chapterId).then((c) => live && setChecks(c))
    return () => {
      live = false
    }
  }, [chapterId])

  // open the section named in the hash (or the first one) and scroll to it
  useEffect(() => {
    if (!checks || !ch) return
    const target = loc.hash.slice(1)
    const first = ch.topics.find((t) => target === t.id) ?? ch.topics[0]
    setOpen((o) => ({ ...o, [first.id]: true }))
    if (target) requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }))
    else window.scrollTo({ top: 0 })
  }, [checks, ch, loc.hash])

  const totals = useMemo(() => {
    if (!checks || !ch) return null
    let correct = 0, answered = 0, mcq = 0, iv = 0, practised = 0
    for (const t of ch.topics) {
      const s = sectionScore(checks[t.id], answers)
      correct += s.correct
      answered += s.answered
      mcq += s.total
      const v = visibleInterview(checks[t.id], project, allProjects)
      iv += v.length
      practised += v.filter((q) => ratings[q.id]).length
    }
    return { correct, answered, mcq, iv, practised }
  }, [checks, ch, answers, ratings, project, allProjects])

  if (!ch || ch.kind !== 'chapter') return <NotFound />
  const count = chapterCheckCount(ch.id)

  return (
    <div className="check-page">
      <motion.header className="ck-head" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Link to={`/${ch.id}`} className="ck-back"><ArrowLeft size={14} /> Chapter {ch.num} · {ch.title}</Link>
        <span className="c-kicker">{partOf(ch)?.label} · Chapter check</span>
        <h1 className="page-h"><ListChecks size={28} /> Chapter {ch.num} check</h1>
        <p className="muted lead">
          {count.mcq} choose-the-answer and {count.interview} interview questions, grouped by section. Your answers and ratings are saved in this browser and count on the{' '}
          <Link to="/practice">Practice page</Link> too.
        </p>
        <div className="ck-bar">
          <div className="seg" role="radiogroup" aria-label="Mode" onKeyDown={onRovingKeyDown}>
            <button type="button" role="radio" aria-checked={mode === 'practice'} tabIndex={mode === 'practice' ? 0 : -1} className={mode === 'practice' ? 'on' : ''} onClick={() => setMode('practice')}>
              Practice <small>feedback after each answer</small>
            </button>
            <button type="button" role="radio" aria-checked={mode === 'check'} tabIndex={mode === 'check' ? 0 : -1} className={mode === 'check' ? 'on' : ''} onClick={() => setMode('check')}>
              Check <small>answer a section, then score it</small>
            </button>
          </div>
          <label className="tgl">
            <input type="checkbox" checked={allProjects} onChange={(e) => setAllProjects(e.target.checked)} /> Show interview questions framed in all projects
          </label>
          <ProjectFramingNote />
          {totals && (
            <span className="ck-score" aria-live="polite">
              <b>{totals.correct}</b>/{totals.mcq} correct · <b>{totals.practised}</b>/{totals.iv} interview practised
            </span>
          )}
        </div>
      </motion.header>

      <nav className="ck-index" aria-label="Sections">
        {ch.topics.map((t) => {
          const n = sectionCheckCount(ch.id, t.id)
          const s = checks ? sectionScore(checks[t.id], answers) : undefined
          return (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={(open[t.id] ? 'on ' : '') + (s && s.total && s.answered === s.total ? 'done' : '')}
              onClick={(e) => {
                e.preventDefault()
                setOpen((o) => ({ ...o, [t.id]: true }))
                requestAnimationFrame(() => document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
              }}
            >
              <span className="mono">{t.tn}</span>
              <span className="ci-t">{t.title}</span>
              <small>{n.mcq + n.interview ? `${n.mcq} + ${n.interview}` : '—'}</small>
            </a>
          )
        })}
      </nav>

      {!checks ? (
        <div className="skeleton" aria-busy="true"><i /><i className="tall" /><i /></div>
      ) : (
        <div className="ck-sections">
          {ch.topics.map((t) => (
            <CheckSection
              key={t.id}
              id={t.id}
              tn={t.tn}
              title={t.title}
              topicPath={`/${ch.id}/${t.id}`}
              sec={checks[t.id]}
              mode={mode}
              project={project}
              allProjects={allProjects}
              open={!!open[t.id]}
              onToggle={() => setOpen((o) => ({ ...o, [t.id]: !o[t.id] }))}
            />
          ))}
        </div>
      )}

      <Link to={`/practice?chapters=${ch.id}`} className="seccheck">
        <Dumbbell size={18} />
        <span>
          <b>Drill this chapter on the Practice page</b>
          <small>Random sets, review your mistakes, or an interview drill</small>
        </span>
      </Link>
    </div>
  )
}
