import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { ListChecks, RotateCcw } from 'lucide-react'
import { chapterCheckCount, courseTopics, formatDuration, parts, progressChapters, sumMinutes, totals } from '../data/course'
import { HtmlContent } from '../components/HtmlContent'
import { useDocumentTitle, useNextTopic, usePage } from '../components/common'
import { ProgressRing } from '../components/Icons'
import { useProgress } from '../store/progress'

export function Guide() {
  useDocumentTitle('How to use this course')
  const html = usePage('home', 'how')
  const loc = useLocation()
  useEffect(() => {
    if (html && loc.hash) document.getElementById(loc.hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [html, loc.hash])
  return (
    <div className="page-narrow">
      <span className="c-kicker">Start here</span>
      <h1 className="page-h">How to use this course</h1>
      {html && <HtmlContent html={html} className="read topic lai-topic" />}
    </div>
  )
}

/** Study time per part and in total, from the same estimate the topic pages use. */
function StudyTime() {
  const rows = parts.map((p) => {
    const ts = courseTopics.filter((t) => p.chapters.includes(t.chapter.id))
    return { id: p.id, label: p.label, title: p.title, topics: ts.length, min: sumMinutes(ts) }
  }).filter((r) => r.topics > 0)
  const total = rows.reduce((a, r) => a + r.min, 0)
  return (
    <div className="tw">
      <table>
        <thead><tr><th>Part</th><th>Topics</th><th>Reading and figures</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}><td>{r.label} · {r.title}</td><td>{r.topics}</td><td>{formatDuration(r.min)}</td></tr>
          ))}
          <tr><td><b>The whole course</b></td><td><b>{totals.topics}</b></td><td><b>{formatDuration(total)}</b></td></tr>
        </tbody>
      </table>
    </div>
  )
}

export function StartPage() {
  useDocumentTitle('Before you start')
  const html = usePage('home', 'start')
  const loc = useLocation()
  useEffect(() => {
    if (html && loc.hash) document.getElementById(loc.hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [html, loc.hash])
  const next = useNextTopic()
  return (
    <div className="page-narrow">
      <span className="c-kicker">Read this first</span>
      <h1 className="page-h">Before you start</h1>
      {html && <HtmlContent html={html} className="read topic lai-topic" slots={{ time: <StudyTime /> }} />}
      <p><Link className="btn primary" to={next.to}>{next.label}</Link></p>
    </div>
  )
}

export function ProgressPage() {
  useDocumentTitle('Your progress')
  const { studied, results, ratings, reset } = useProgress()
  const done = courseTopics.filter((t) => studied[t.id]).length
  const nextTopic = useNextTopic()
  const right = Object.values(results).filter(Boolean).length
  const tried = Object.keys(results).length
  const practised = Object.keys(ratings).length
  const byChapter = (id: string) => {
    const pre = id + '-'
    const r = Object.entries(results).filter(([k]) => k.startsWith(pre))
    return { right: r.filter(([, v]) => v).length, tried: r.length, practised: Object.keys(ratings).filter((k) => k.startsWith(pre)).length }
  }
  return (
    <div className="page-narrow">
      <span className="c-kicker">Stored only in this browser</span>
      <h1 className="page-h">Your progress</h1>
      {done === 0 && (
        <p className="muted prog-zero">
          No topics studied yet. <Link to={nextTopic.to}>{nextTopic.label}</Link>
        </p>
      )}
      <div className="prog-sum">
        <div><ProgressRing value={done / totals.topics} size={96} stroke={8} /><b>{done}/{totals.topics}</b><span>topics studied</span></div>
        <div><ProgressRing value={totals.mcq ? right / totals.mcq : 0} size={96} stroke={8} /><b>{right}/{totals.mcq}</b><span>choose-the-answer correct{tried > right ? ` · ${tried - right} wrong` : ''}</span></div>
        <div><ProgressRing value={totals.interview ? practised / totals.interview : 0} size={96} stroke={8} /><b>{practised}/{totals.interview}</b><span>interview questions practised</span></div>
      </div>
      <div className="heatmap" role="table" aria-label="Topics studied per chapter and in the capstone">
        {progressChapters.map((c) => (
          <div key={c.id} className="hm-row" role="row">
            <Link to={`/${c.id}`} className="hm-ch" role="rowheader">
              <span className="mono">{c.num}</span> {c.title}
            </Link>
            {c.kind === 'chapter' ? (
              <Link to={`/${c.id}/check`} className="hm-check" role="cell" title="Chapter check: correct answers and interview questions practised">
                <ListChecks size={13} /> {byChapter(c.id).right}/{chapterCheckCount(c.id).mcq} · {byChapter(c.id).practised}/{chapterCheckCount(c.id).interview}
              </Link>
            ) : (
              <span className="hm-check" role="cell">No check</span>
            )}
            <div className="hm-cells" role="cell">
              {c.topics.map((t) => (
                <Link key={t.id} to={`/${c.id}/${t.id}`} className={'hm-cell' + (studied[t.id] ? ' on' : '')} title={`${t.tn} ${t.title}${studied[t.id] ? ' · studied' : ''}`}>
                  <span className="sr-only">{t.tn} {studied[t.id] ? 'studied' : 'not studied'}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn"
        onClick={() => {
          if (confirm('Clear all study progress, check answers and interview ratings in this browser? Your example project choice is kept.')) reset()
        }}
      >
        <RotateCcw size={14} /> Reset all progress
      </button>
    </div>
  )
}
