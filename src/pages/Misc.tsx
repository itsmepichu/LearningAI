import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { chapters, courseChapters, courseTopics, getChapter, paths, totals } from '../data/course'
import { HtmlContent } from '../components/HtmlContent'
import { useDocumentTitle, usePage } from '../components/common'
import { ProgressRing } from '../components/Icons'
import { useProgress } from '../store/progress'

export function Guide() {
  useDocumentTitle('How to use this manual')
  const html = usePage('home', 'how')
  const loc = useLocation()
  useEffect(() => {
    if (html && loc.hash) document.getElementById(loc.hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [html, loc.hash])
  return (
    <div className="page-narrow">
      <span className="c-kicker">Start here</span>
      <h1 className="page-h">How to use this manual</h1>
      {html && <HtmlContent html={html} className="read topic lai-topic" />}
    </div>
  )
}

export function Paths() {
  useDocumentTitle('Learning paths')
  const studied = useProgress((s) => s.studied)
  const loc = useLocation()
  useEffect(() => {
    if (loc.hash) document.getElementById(loc.hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [loc.hash])
  return (
    <div className="page-narrow">
      <span className="c-kicker">Plan your route</span>
      <h1 className="page-h">Learning paths</h1>
      <p className="muted lead">Each path orders the chapters that matter most for a role. Chapters you finish count towards every path that includes them.</p>
      {paths.map((p) => {
        const ids = p.chapters.flatMap((c) => getChapter(c)!.topics.map((t) => t.id))
        const n = ids.filter((i) => studied[i]).length
        return (
          <section key={p.id} id={p.id} className="path-detail">
            <header>
              <ProgressRing value={n / ids.length} size={46} stroke={5} />
              <div>
                <span className="path-who">{p.who}</span>
                <h2>{p.title}</h2>
                <p className="muted">{p.blurb}</p>
              </div>
            </header>
            <ol className="path-steps">
              {p.chapters.map((cid, i) => {
                const c = getChapter(cid)!
                const k = c.topics.filter((t) => studied[t.id]).length
                const next = c.topics.find((t) => !studied[t.id]) ?? c.topics[0]
                return (
                  <li key={cid} className={k === c.topics.length ? 'done' : k ? 'part' : ''}>
                    <span className="ps-i">{i + 1}</span>
                    <Link to={`/${c.id}`} className="ps-b">
                      <b><span className="mono">{c.num}</span> {c.title}</b>
                      <small>{k}/{c.topics.length} topics studied</small>
                    </Link>
                    <Link to={`/${c.id}/${next.id}`} className="ps-go" aria-label={`Open ${next.tn}`}>
                      {next.tn} <ArrowRight size={13} />
                    </Link>
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}
    </div>
  )
}

export function ProgressPage() {
  useDocumentTitle('Your progress')
  const { studied, quiz, reset } = useProgress()
  const done = courseTopics.filter((t) => studied[t.id]).length
  const qTotal = totals.questions
  const qRight = chapters.reduce((a, c) => a + c.quiz.filter((q, i) => quiz[`${c.id}:${i}`] === q.answer).length, 0)
  return (
    <div className="page-narrow">
      <span className="c-kicker">Stored only in this browser</span>
      <h1 className="page-h">Your progress</h1>
      <div className="prog-sum">
        <div><ProgressRing value={done / totals.topics} size={96} stroke={8} /><b>{done}/{totals.topics}</b><span>topics studied</span></div>
        <div><ProgressRing value={qRight / qTotal} size={96} stroke={8} /><b>{qRight}/{qTotal}</b><span>self-check answers correct</span></div>
      </div>
      <div className="heatmap" role="table" aria-label="Topics studied per chapter">
        {courseChapters.map((c) => (
          <div key={c.id} className="hm-row" role="row">
            <Link to={`/${c.id}`} className="hm-ch" role="rowheader">
              <span className="mono">{c.num}</span> {c.title}
            </Link>
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
          if (confirm('Clear all study progress and quiz answers in this browser?')) reset()
        }}
      >
        <RotateCcw size={14} /> Reset all progress
      </button>
    </div>
  )
}
