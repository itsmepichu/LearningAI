import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, Layers3, Trash2 } from 'lucide-react'
import { getTopic, topicPath } from '../data/course'
import { loadChecks, LEVEL_LABEL, answerSet, type InterviewQ, type Mcq } from '../data/checks'
import { chapterOf, dueIds, formatWait, GRADES, nextDue, preview, type GradeName } from '../data/flashcards'
import { fill, getProject } from '../data/projects'
import { useProgress } from '../store/progress'
import { useDocumentTitle } from '../components/common'

type Found = { type: 'mcq'; q: Mcq; topic: string } | { type: 'iv'; q: InterviewQ; topic: string }

const GRADE_LABEL: Record<GradeName, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' }

/** Finds the deck's questions in their chapters' check files. */
function useQuestions(ids: string[]) {
  const [found, setFound] = useState<Record<string, Found>>({})
  const chapters = useMemo(() => [...new Set(ids.map(chapterOf))].sort(), [ids])
  useEffect(() => {
    let live = true
    Promise.all(chapters.map(loadChecks)).then((all) => {
      if (!live) return
      const out: Record<string, Found> = {}
      for (const checks of all)
        for (const [topic, sec] of Object.entries(checks)) {
          for (const q of sec.mcq ?? []) out[q.id] = { type: 'mcq', q, topic }
          for (const q of sec.interview ?? []) out[q.id] = { type: 'iv', q, topic }
        }
      setFound(out)
    })
    return () => {
      live = false
    }
  }, [chapters])
  return found
}

export function FlashcardsPage() {
  useDocumentTitle('Flashcards')
  const cards = useProgress((s) => s.cards)
  const reviewCard = useProgress((s) => s.reviewCard)
  const removeCard = useProgress((s) => s.removeCard)
  const [now, setNow] = useState(() => new Date())
  const [shown, setShown] = useState(false)
  const ids = useMemo(() => Object.keys(cards), [cards])
  const found = useQuestions(ids)

  // Cards graded "again" come back within minutes, so the due list is refreshed while the page is open.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  const due = useMemo(() => dueIds(cards, now).filter((id) => found[id]), [cards, now, found])
  const current = due[0]
  const card = current ? cards[current] : undefined
  const waits = useMemo(() => (card ? preview(card, now) : undefined), [card, now])
  const next = nextDue(cards)

  const grade = (g: GradeName) => {
    if (!current) return
    reviewCard(current, g)
    setShown(false)
    setNow(new Date())
  }

  // Space shows the answer; 1–4 grade it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      if (!current || tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return
      if (!shown && e.key === ' ' && tag !== 'button') {
        e.preventDefault()
        setShown(true)
      } else if (shown && ['1', '2', '3', '4'].includes(e.key)) grade(GRADES[+e.key - 1])
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  return (
    <div className="flashcards-page page-narrow">
      <span className="c-kicker">Spaced repetition · whole course</span>
      <h1 className="page-h">
        <Layers3 size={28} /> Flashcards
      </h1>
      <p className="muted lead">
        Questions from the chapter checks, brought back just before you are likely to forget them (the FSRS scheduler). A choose-the-answer question you get
        wrong, or an interview question you mark “Missed it”, joins the deck by itself; add any other with “Add to flashcards”. The deck is saved in this
        browser only.
      </p>
      <ul className="fc-stats" aria-label="Deck">
        <li>
          <b>{ids.length}</b> in the deck
        </li>
        <li>
          <b>{due.length}</b> due now
        </li>
        {!current && next && next > now && (
          <li>
            next in <b>{formatWait(next.getTime() - now.getTime())}</b>
          </li>
        )}
      </ul>

      {current && found[current] ? (
        <FlashCard key={current + (cards[current]?.reps ?? 0)} item={found[current]} shown={shown} onShow={() => setShown(true)} />
      ) : (
        <div className="fc-empty">
          <CheckCircle2 size={20} />
          <p>
            {ids.length === 0 ? (
              <>
                The deck is empty. Answer questions on a chapter's check page or on the <Link to="/practice">Practice page</Link>, and the ones you miss land here.
              </>
            ) : (
              <>Nothing is due. Come back when the next card is due, or keep working through the chapters.</>
            )}
          </p>
        </div>
      )}

      {current && shown && waits && (
        <div className="fc-grades" role="group" aria-label="How well did you remember it?">
          {GRADES.map((g, i) => (
            <button key={g} type="button" className={'btn g-' + g} onClick={() => grade(g)}>
              <span>
                {GRADE_LABEL[g]} <kbd>{i + 1}</kbd>
              </span>
              <small>{formatWait(waits[g].getTime() - now.getTime())}</small>
            </button>
          ))}
        </div>
      )}

      {ids.length > 0 && (
        <details className="fc-deck">
          <summary>All cards ({ids.length})</summary>
          <ul>
            {ids
              .slice()
              .sort((a, b) => Date.parse(cards[a].due) - Date.parse(cards[b].due))
              .map((id) => {
                const f = found[id]
                const wait = Date.parse(cards[id].due) - now.getTime()
                return (
                  <li key={id}>
                    <span className="fc-q">{f ? f.q.q : id}</span>
                    <span className="muted">{wait <= 0 ? 'due' : `in ${formatWait(wait)}`}</span>
                    <button type="button" className="icon-btn" aria-label={`Remove “${f ? f.q.q : id}” from the deck`} onClick={() => removeCard(id)}>
                      <Trash2 size={15} />
                    </button>
                  </li>
                )
              })}
          </ul>
        </details>
      )}
    </div>
  )
}

function FlashCard({ item, shown, onShow }: { item: Found; shown: boolean; onShow: () => void }) {
  const topic = getTopic(item.topic)
  const p = item.type === 'iv' && item.q.project ? getProject(item.q.project) : undefined
  const text = (t: string) => (p ? fill(t, p) : t)
  return (
    <article className="fc-card" aria-labelledby="fc-q">
      <div className="mcq-meta">
        {topic && (
          <Link className="badge" to={topicPath(topic)}>
            {topic.tn} {topic.title}
          </Link>
        )}
        <span className="badge">{item.type === 'mcq' ? 'Choose the answer' : `Interview · ${LEVEL_LABEL[item.q.level]}`}</span>
      </div>
      <h2 id="fc-q" className="as-h4">
        {text(item.q.q)}
      </h2>
      {item.type === 'mcq' && (
        <ol className="fc-opts" type="A">
          {item.q.options.map((o, j) => (
            <li key={j} className={shown && answerSet(item.q).has(j) ? 'answer' : ''}>
              {o}
              {shown && answerSet(item.q).has(j) && <span className="sr-only"> (right answer)</span>}
            </li>
          ))}
        </ol>
      )}
      {!shown ? (
        <button type="button" className="btn primary" onClick={onShow}>
          Show the answer <kbd>Space</kbd>
        </button>
      ) : (
        <div className="fc-back" role="status">
          {item.type === 'mcq' ? (
            <p>{item.q.why}</p>
          ) : (
            <>
              <p className="muted">A strong answer covers:</p>
              <ul>
                {item.q.covers.map((c, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: text(c) }} />
                ))}
              </ul>
              {item.q.followUp && (
                <p className="iv-fu">
                  <b>Likely follow-up:</b> {text(item.q.followUp)}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </article>
  )
}
