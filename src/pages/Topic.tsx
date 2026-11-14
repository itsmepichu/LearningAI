import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, Clock, FlaskConical, Layers, ListChecks, MousePointerClick } from 'lucide-react'
import { allTopics, getChapter, getTopic, minutes, partOf, sectionCheckCount, shortTitle, topicPath } from '../data/course'
import { ExampleDataBanner, PracticeBlock, useChapterPractice } from '../components/Practice'
import { hasWorkshop, workshopPath } from '../data/workshop'
import { HtmlContent } from '../components/HtmlContent'
import { QuickCheck } from '../components/QuickCheck'
import { Tags, useDocumentTitle, usePage } from '../components/common'
import { useProgress } from '../store/progress'
import { NotFound } from './NotFound'

interface Mark { id: string; label: string; kind: 'part' | 'fig' | 'box' | 'ff' }


export function TopicPage() {
  const { chapterId, topicId } = useParams()
  const topic = getTopic(topicId)
  const chapter = getChapter(chapterId)
  const html = usePage(chapterId, topicId, !!topic)
  const loc = useLocation()
  const navigate = useNavigate()
  const studiedMap = useProgress((s) => s.studied)
  const studied = !!(topicId && studiedMap[topicId])
  const setStudied = useProgress((s) => s.setStudied)
  const visit = useProgress((s) => s.visit)
  const [marks, setMarks] = useState<Mark[]>([])
  const [active, setActive] = useState<string>('')
  const body = useRef<HTMLDivElement>(null)
  const chapterPractice = useChapterPractice(chapterId)
  const practice = topicId ? chapterPractice?.[topicId] : undefined
  useDocumentTitle(topic ? `${topic.tn} ${topic.title}` : 'Not found')

  useEffect(() => {
    if (topic) visit(topicPath(topic))
  }, [topic, visit])

  // Build "On this page" from the topic's parts (Intuition, Mechanism, …), figures and callouts, then follow the reader.
  useEffect(() => {
    if (!html || !body.current) return
    const els = [...body.current.querySelectorAll<HTMLElement>('.tp, figure, .box, .ff, [data-slot="practice"], .terms, .tools')]
    const list: Mark[] = []
    els.forEach((el, i) => {
      let label = ''
      let kind: Mark['kind'] = 'box'
      const cl = el.classList
      if (cl.contains('tp')) {
        kind = 'part'
        label = el.querySelector('h2,h3,h4')?.textContent || 'Part'
      } else if (el.tagName === 'FIGURE') {
        kind = 'fig'
        label = el.querySelector('figcaption b')?.textContent || el.querySelector('figcaption')?.textContent?.slice(0, 60) || 'Figure'
      } else if (cl.contains('ff') || el.dataset.slot === 'practice') {
        kind = 'ff'
        label = 'In practice, failure to avoid, try it'
      } else if (cl.contains('terms')) label = 'Terms'
      else if (cl.contains('tools')) label = 'Tools'
      else label = el.querySelector('h2,h3,h4,h5,h6')?.textContent || 'Note'
      if (!el.id) el.id = `m-${topicId}-${i}`
      list.push({ id: el.id, label: label.replace(/\.$/, '').trim(), kind })
    })
    setMarks(list)
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-20% 0px -65% 0px' },
    )
    els.forEach((el) => io.observe(el))
    // honour a #hash from search or cross-links once the content exists
    if (loc.hash) {
      const t = document.getElementById(decodeURIComponent(loc.hash.slice(1)))
      if (t) requestAnimationFrame(() => t.scrollIntoView({ block: 'start' }))
    } else window.scrollTo({ top: 0 })
    return () => io.disconnect()
  }, [html, topicId, loc.hash])

  // [ and ] move between topics
  const prev = topic ? allTopics[topic.index - 1] : undefined
  const next = topic ? allTopics[topic.index + 1] : undefined
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (e.key === '[' && prev) navigate(topicPath(prev))
      if (e.key === ']' && next) navigate(topicPath(next))
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [prev, next, navigate])

  if (!topic || !chapter || topic.chapter.id !== chapter.id) return <NotFound />
  const part = partOf(chapter)
  const pos = chapter.topics.findIndex((t) => t.id === topic.id)

  return (
    <div className="topic-page">
      <motion.header className="t-head" key={topic.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="t-kicker">
          {part && <span>{part.label}</span>}
          <Link to={`/${chapter.id}`}>
            Chapter {chapter.num} · {chapter.title}
          </Link>
        </div>
        <h1>
          <span className="tn">{topic.tn}</span>
          {shortTitle(topic)}
        </h1>
        {topic.short && topic.short !== topic.title && <p className="t-covers"><b>Covers</b> {topic.title}</p>}
        <div className="t-meta">
          <span>
            <Clock size={14} /> about {minutes(topic)} min
          </span>
          {topic.figures > 0 && (
            <span>
              <Layers size={14} /> {topic.figures} {topic.figures === 1 ? 'figure' : 'figures'}
            </span>
          )}
          {topic.interactive > 0 && (
            <span>
              <MousePointerClick size={14} /> {topic.interactive} interactive
            </span>
          )}
          <Tags tags={topic.tags} />
          <label className={'studied-toggle' + (studied ? ' on' : '')}>
            <input type="checkbox" checked={studied} onChange={(e) => setStudied(topic.id, e.target.checked)} />
            <Check size={14} /> {studied ? 'Studied' : 'Mark as studied'}
          </label>
        </div>
        <nav className="t-steps" aria-label="Topics in this chapter">
          {chapter.topics.map((t, i) => (
            <Link key={t.id} to={`/${chapter.id}/${t.id}`} className={(i === pos ? 'cur ' : '') + (studiedMap[t.id] ? 'done' : '')} title={`${t.tn} ${shortTitle(t)}`} aria-current={i === pos ? 'page' : undefined}>
              <span className="sr-only">{t.tn} {shortTitle(t)}</span>
            </Link>
          ))}
        </nav>
      </motion.header>

      <details className="t-toc">
        <summary>On this page{marks.length > 0 && ` · ${marks.length} ${marks.length === 1 ? 'item' : 'items'}`}</summary>
        {marks.length > 0 && (
          <ol>
            {marks.map((m) => (
              <li key={m.id}>
                <MarkLink mark={m} />
              </li>
            ))}
          </ol>
        )}
        <p>
          {hasWorkshop(chapter.id) && <Link to={workshopPath(chapter.id, topic.id)}><FlaskConical size={14} /> Chapter {chapter.num} workshop</Link>}
          <Link to={`/${chapter.id}/check#${topic.id}`}><ListChecks size={14} /> Check this section</Link>
        </p>
      </details>

      <div className="t-grid">
        <div ref={body} className="t-body">
          {!!topic.outcomes?.length && (
            <section className="outcomes" aria-label="After this topic you can">
              <h2>After this topic you can</h2>
              <ul>{topic.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>
            </section>
          )}
          <ExampleDataBanner chapterId={chapter.id} topicId={topic.id} />
          {html === null ? (
            <div className="skeleton" aria-busy="true">
              <i /><i /><i /><i className="tall" /><i />
            </div>
          ) : (
            <HtmlContent key={topic.id} html={html} className="topic lai-topic" autoGlossary slots={{ practice: <PracticeBlock practice={practice} chapterId={chapter.id} topicId={topic.id} /> }} />
          )}

          {html !== null && <QuickCheck chapterId={chapter.id} topicId={topic.id} />}
          {html !== null && <SectionCheckLink chapterId={chapter.id} topicId={topic.id} tn={topic.tn} />}

          {html !== null && !!topic.outcomes?.length && (
            <section className="outcomes recap" aria-label="Recap">
              <h2>Recap: you can now</h2>
              <ul>{topic.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>
            </section>
          )}

          <div className="t-finish">
            <button type="button" className={'btn ' + (studied ? '' : 'primary')} onClick={() => setStudied(topic.id, !studied)}>
              <Check size={15} /> {studied ? 'Marked as studied' : 'I have studied this topic'}
            </button>
            <span className="muted">Progress is saved in this browser only.</span>
          </div>

          <nav className="pager" aria-label="Previous and next topic">
            {prev ? (
              <Link to={topicPath(prev)} className="pg prev">
                <small><ArrowLeft size={13} /> Previous <kbd>[</kbd></small>
                <b><span className="mono">{prev.tn}</span> {shortTitle(prev)}</b>
              </Link>
            ) : <span />}
            {next ? (
              <Link to={topicPath(next)} className="pg next">
                <small>Next <kbd>]</kbd> <ArrowRight size={13} /></small>
                <b><span className="mono">{next.tn}</span> {shortTitle(next)}</b>
              </Link>
            ) : <span />}
          </nav>
        </div>

        <aside className="t-rail" aria-label="On this page">
          {marks.length > 0 && (
            <>
              <div className="rail-h">On this page</div>
              <ol>
                {marks.map((m) => (
                  <li key={m.id}>
                    <MarkLink mark={m} className={(active === m.id ? 'on ' : '') + 'rk-' + m.kind} />
                  </li>
                ))}
              </ol>
            </>
          )}
          {hasWorkshop(chapter.id) && (
            <Link className="rail-lab" to={workshopPath(chapter.id, topic.id)}>
              <span><FlaskConical size={13} /> Chapter {chapter.num} workshop</span> <ArrowRight size={13} />
            </Link>
          )}
          <Link className="rail-lab chk" to={`/${chapter.id}/check#${topic.id}`}>
            <span><ListChecks size={13} /> Check this section</span> <ArrowRight size={13} />
          </Link>
        </aside>
      </div>
    </div>
  )
}

function MarkLink({ mark, className }: { mark: Mark; className?: string }) {
  return (
    <a
      href={'#' + mark.id}
      className={className}
      onClick={(e) => {
        e.preventDefault()
        document.getElementById(mark.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }}
    >
      {mark.label}
    </a>
  )
}

function SectionCheckLink({ chapterId, topicId, tn }: { chapterId: string; topicId: string; tn: string }) {
  const n = sectionCheckCount(chapterId, topicId)
  const total = n.mcq + n.interview
  const more = n.mcq - n.core
  return (
    <Link to={`/${chapterId}/check#${topicId}`} className="seccheck">
      <ListChecks size={18} />
      <span>
        <b>{n.core ? `More practice for section ${tn}` : `Check section ${tn}`}</b>
        <small>
          {total
            ? `${n.core ? `${more} extended ${more === 1 ? 'question' : 'questions'}` : `${n.mcq} choose-the-answer`} · ${n.interview} interview ${n.interview === 1 ? 'question' : 'questions'}`
            : 'Questions for this section are being written'}
        </small>
      </span>
      <ArrowRight size={16} />
    </Link>
  )
}
