import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { BookmarkCheck, BookmarkPlus, CheckCircle2, ChevronDown, Eye, EyeOff, MessagesSquare, RotateCcw, XCircle } from 'lucide-react'
import { KIND_LABEL, LEVEL_LABEL, answerSet, isCorrect, isMulti, type InterviewQ, type Mcq, type Section } from '../data/checks'
import { fill, getProject, type ProjectId } from '../data/projects'
import { useProgress, type Answer, type Rating } from '../store/progress'
import { ProjectIcon } from './ProjectPicker'

export type Mode = 'practice' | 'check'

/* ---------------------------------------------------------------- choose the answer */

interface McqProps {
  q: Mcq
  mode: Mode
  /** Check mode: the parent owns the draft answer and when to reveal. */
  draft?: Answer
  onDraft?: (a: Answer | undefined) => void
  reveal?: boolean
  index?: number
  context?: React.ReactNode
  /** The card sits directly under the page h1, so its heading is an h2. */
  topLevel?: boolean
}

export function McqCard({ q, mode, draft, onDraft, reveal, index, context, topLevel }: McqProps) {
  const H = topLevel ? 'h2' : 'h4'
  const saved = useProgress((s) => s.answers[q.id])
  const answer = useProgress((s) => s.answer)
  const clear = useProgress((s) => s.clearAnswers)
  const multi = isMulti(q)
  const [local, setLocal] = useState<number[]>([])
  const right = answerSet(q)

  const shown: Answer | undefined = mode === 'check' ? draft : saved
  const revealed = mode === 'check' ? !!reveal : saved !== undefined
  const picked = new Set(revealed || mode === 'check' ? (shown === undefined ? [] : Array.isArray(shown) ? shown : [shown]) : multi ? local : [])
  const ok = revealed ? isCorrect(q, shown) : undefined

  const choose = (j: number) => {
    if (revealed) return
    if (mode === 'check') {
      if (multi) {
        const cur = new Set(Array.isArray(draft) ? draft : [])
        cur.has(j) ? cur.delete(j) : cur.add(j)
        onDraft?.(cur.size ? [...cur].sort() : undefined)
      } else onDraft?.(j)
      return
    }
    if (multi) setLocal((l) => (l.includes(j) ? l.filter((x) => x !== j) : [...l, j].sort()))
    else answer(q.id, j, isCorrect(q, j)!)
  }

  return (
    <article className={'mcq' + (ok === true ? ' right' : ok === false ? ' wrong' : '')} aria-labelledby={`${q.id}-q`}>
      <header>
        {index !== undefined && <span className="qn">{index + 1}</span>}
        <H id={`${q.id}-q`} className="as-h4">{q.q}</H>
      </header>
      <div className="mcq-meta">
        {q.kind && <span className="badge">{KIND_LABEL[q.kind]}</span>}
        {multi && <span className="badge multi">Choose all that apply</span>}
        {context}
        <CardToggle qid={q.id} />
      </div>
      <div className="mcq-opts" role={multi ? 'group' : 'radiogroup'} aria-labelledby={`${q.id}-q`}>
        {q.options.map((o, j) => {
          const isPicked = picked.has(j)
          const cls = ['opt', isPicked ? 'picked' : '', revealed && right.has(j) ? 'answer' : '', revealed && isPicked && !right.has(j) ? 'miss' : ''].join(' ')
          return (
            <label key={j} className={cls}>
              <input
                type={multi ? 'checkbox' : 'radio'}
                name={q.id}
                checked={isPicked}
                disabled={revealed}
                onChange={() => choose(j)}
              />
              <span>{o}</span>
              {revealed && right.has(j) && <CheckCircle2 size={15} className="opt-ic ok" aria-label="correct option" />}
              {revealed && isPicked && !right.has(j) && <XCircle size={15} className="opt-ic bad" aria-label="your choice, incorrect" />}
            </label>
          )
        })}
      </div>
      {mode === 'practice' && multi && !revealed && (
        <button type="button" className="btn sm primary" disabled={!local.length} onClick={() => answer(q.id, local, isCorrect(q, local)!)}>
          Check answer
        </button>
      )}
      {revealed && (
        <div className="mfb" role="status">
          <p>
            <b>{ok ? 'Correct.' : shown === undefined ? 'Not answered.' : 'Not quite.'}</b> {q.why}
          </p>
          {!ok && shown !== undefined && q.distractors && (
            <ul className="mfb-why">
              {[...picked].filter((j) => !right.has(j) && q.distractors![j]).map((j) => (
                <li key={j}>
                  <b>“{q.options[j]}”</b>: {q.distractors![j]}
                </li>
              ))}
            </ul>
          )}
          {q.distractors && (
            <details className="mfb-all">
              <summary>Why the other options are wrong</summary>
              <ul>
                {q.options.map((o, j) => (!right.has(j) && q.distractors![j] ? <li key={j}><b>{o}</b>: {q.distractors![j]}</li> : null))}
              </ul>
            </details>
          )}
          {mode === 'practice' && (
            <button type="button" className="linkish" onClick={() => { clear([q.id]); setLocal([]) }}>
              <RotateCcw size={12} /> Try again
            </button>
          )}
        </div>
      )}
    </article>
  )
}

/** Adds the question to the flashcard deck, or takes it out. */
export function CardToggle({ qid }: { qid: string }) {
  const inDeck = useProgress((s) => !!s.cards[qid])
  const add = useProgress((s) => s.addCard)
  const remove = useProgress((s) => s.removeCard)
  return (
    <button type="button" className={'card-tg' + (inDeck ? ' on' : '')} aria-pressed={inDeck} onClick={() => (inDeck ? remove(qid) : add(qid))}>
      {inDeck ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />} {inDeck ? 'In flashcards' : 'Add to flashcards'}
    </button>
  )
}

/* ---------------------------------------------------------------- interview */

const RATINGS: { id: Rating; label: string }[] = [
  { id: 'missed', label: 'Missed it' },
  { id: 'partly', label: 'Partly' },
  { id: 'covered', label: 'Covered it' },
]

export function InterviewCard({ q, index, context, defaultOpen = false, topLevel }: { q: InterviewQ; index?: number; context?: React.ReactNode; defaultOpen?: boolean; topLevel?: boolean }) {
  const H = topLevel ? 'h2' : 'h4'
  const [open, setOpen] = useState(defaultOpen)
  const rating = useProgress((s) => s.ratings[q.id])
  const rate = useProgress((s) => s.rate)
  const p = q.project ? getProject(q.project) : undefined
  return (
    <article className={'iv lv-' + q.level + (rating ? ' rated-' + rating : '')} aria-labelledby={`${q.id}-q`}>
      <header>
        {index !== undefined && <span className="qn"><MessagesSquare size={13} /></span>}
        <H id={`${q.id}-q`} className="as-h4">{p ? fill(q.q, p) : q.q}</H>
      </header>
      <div className="mcq-meta">
        <span className={'badge lv ' + q.level}>{LEVEL_LABEL[q.level]}</span>
        {p && (
          <span className="badge proj" style={{ ['--pc' as string]: `var(${p.accent})` }}>
            <ProjectIcon id={p.id} size={12} /> {p.label}
          </span>
        )}
        {context}
        <CardToggle qid={q.id} />
      </div>
      <button type="button" className="iv-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <EyeOff size={14} /> : <Eye size={14} />} {open ? 'Hide' : 'Show'} what a strong answer covers
      </button>
      {open && (
        <div className="iv-body">
          <ul>
            {q.covers.map((c, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: p ? fill(c, p) : c }} />
            ))}
          </ul>
          {q.followUp && (
            <p className="iv-fu">
              <b>Likely follow-up:</b> {p ? fill(q.followUp, p) : q.followUp}
            </p>
          )}
        </div>
      )}
      <div className="iv-rate" role="group" aria-label="How well did you answer?">
        <span>How did you do?</span>
        {RATINGS.map((r) => (
          <button key={r.id} type="button" className={'lchip r-' + r.id + (rating === r.id ? ' on' : '')} aria-pressed={rating === r.id} onClick={() => rate(q.id, rating === r.id ? undefined : r.id)}>
            {r.label}
          </button>
        ))}
      </div>
    </article>
  )
}

/* ---------------------------------------------------------------- section */

export function sectionScore(sec: Section | undefined, answers: Record<string, Answer>) {
  const mcq = sec?.mcq ?? []
  const answered = mcq.filter((q) => answers[q.id] !== undefined)
  const correct = answered.filter((q) => isCorrect(q, answers[q.id])).length
  return { total: mcq.length, answered: answered.length, correct }
}

export function visibleInterview(sec: Section | undefined, project: ProjectId, allProjects: boolean) {
  return (sec?.interview ?? []).filter((q) => !q.project || allProjects || q.project === project)
}

interface SectionProps {
  id: string
  tn: string
  title: string
  topicPath: string
  sec: Section | undefined
  mode: Mode
  project: ProjectId
  allProjects: boolean
  open: boolean
  onToggle: () => void
}

export function CheckSection({ id, tn, title, topicPath, sec, mode, project, allProjects, open, onToggle }: SectionProps) {
  const answers = useProgress((s) => s.answers)
  const ratings = useProgress((s) => s.ratings)
  const answer = useProgress((s) => s.answer)
  const clear = useProgress((s) => s.clearAnswers)
  const [draft, setDraft] = useState<Record<string, Answer>>({})
  const [submitted, setSubmitted] = useState(false)
  const mcq = sec?.mcq ?? []
  const iv = useMemo(() => visibleInterview(sec, project, allProjects), [sec, project, allProjects])
  const score = sectionScore(sec, answers)
  const practised = iv.filter((q) => ratings[q.id]).length
  const empty = !mcq.length && !iv.length

  const submit = () => {
    mcq.forEach((q) => draft[q.id] !== undefined && answer(q.id, draft[q.id], isCorrect(q, draft[q.id])!))
    setSubmitted(true)
  }
  const retry = () => {
    clear(mcq.map((q) => q.id))
    setDraft({})
    setSubmitted(false)
  }

  return (
    <section className={'csec' + (open ? ' open' : '')} id={id} aria-labelledby={`${id}-h`}>
      <h2 className="csec-hh">
        <button type="button" className="csec-h" aria-expanded={open} onClick={onToggle}>
          <span className="tn">{tn}</span>
          <span className="csec-t" id={`${id}-h`}>{title}</span>
          <span className="csec-s">
            {empty ? (
              <span className="muted">questions coming</span>
            ) : (
              <>
                {mcq.length > 0 && <span className={'pill' + (score.answered === score.total && score.total ? ' done' : '')}>{score.correct}/{score.total}</span>}
                {iv.length > 0 && <span className="pill iv">{practised}/{iv.length} practised</span>}
              </>
            )}
          </span>
          <ChevronDown size={16} className="csec-chev" />
        </button>
      </h2>
      {open && (
        <div className="csec-b">
          {empty && (
            <p className="muted">
              Questions for this section are being written. Until then, re-read <Link to={topicPath}>the topic</Link>.
            </p>
          )}
          {mcq.length > 0 && (
            <>
              <h3 className="csec-k">Choose the answer <small>{mcq.length}</small></h3>
              {mode === 'check' && !submitted && (
                <p className="muted small">Check mode: answer every question, then submit to see your score and the explanations.</p>
              )}
              <div className="cards">
                {mcq.map((q, i) => (
                  <McqCard
                    key={q.id}
                    q={q}
                    mode={mode}
                    index={i}
                    draft={submitted ? answers[q.id] : draft[q.id]}
                    onDraft={(a) => setDraft((d) => { const n = { ...d }; if (a === undefined) delete n[q.id]; else n[q.id] = a; return n })}
                    reveal={submitted}
                  />
                ))}
              </div>
              {mode === 'check' && (
                <div className="csec-submit">
                  {!submitted ? (
                    <button type="button" className="btn primary" onClick={submit} disabled={!Object.keys(draft).length}>
                      Submit section ({Object.keys(draft).length}/{mcq.length} answered)
                    </button>
                  ) : (
                    <>
                      <b>Score: {sectionScore(sec, answers).correct}/{mcq.length}</b>
                      <button type="button" className="btn" onClick={retry}><RotateCcw size={14} /> Retry section</button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
          {iv.length > 0 && (
            <>
              <h3 className="csec-k">Interview questions <small>{iv.length}</small></h3>
              <p className="muted small">Answer out loud or in notes first, then compare with the checklist and rate yourself.</p>
              <div className="cards">
                {iv.map((q, i) => (
                  <InterviewCard key={q.id} q={q} index={i} />
                ))}
              </div>
            </>
          )}
          <Link to={topicPath} className="linkish small">Back to topic {tn}</Link>
        </div>
      )}
    </section>
  )
}
