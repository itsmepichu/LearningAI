import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, Dumbbell, Filter, MessagesSquare, RotateCcw, Shuffle, Target } from 'lucide-react'
import { chapterCheckCount, chaptersWithChecks, getTopic } from '../data/course'
import { LEVEL_LABEL, isCorrect, loadChecks, type ChapterChecks, type InterviewQ, type Level, type Mcq } from '../data/checks'
import { McqCard, InterviewCard } from '../components/Checks'
import { ProjectFramingNote, useActiveProject } from '../components/Practice'
import { onRovingKeyDown } from '../components/common'
import { useDocumentTitle } from '../components/common'
import { useProgress } from '../store/progress'

type Item = { type: 'mcq'; q: Mcq; ch: string; topic: string } | { type: 'iv'; q: InterviewQ; ch: string; topic: string }
type Tab = 'random' | 'mistakes' | 'drill'
type Status = 'all' | 'new' | 'wrong' | 'practised'

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

function Ctx({ it }: { it: Item }) {
  const t = getTopic(it.topic)
  return t ? (
    <Link className="badge ctx" to={`/${it.ch}/${it.topic}`} title={t.title}>
      {t.tn} {t.title.length > 42 ? t.title.slice(0, 40) + '…' : t.title}
    </Link>
  ) : null
}

export function PracticePage() {
  useDocumentTitle('Practice')
  const [params, setParams] = useSearchParams()
  const available = chaptersWithChecks()
  const fromUrl = (params.get('chapters') || '').split(',').filter((c) => available.some((a) => a.id === c))
  const [chapters, setChapters] = useState<string[]>(fromUrl.length ? fromUrl : available.map((c) => c.id))
  const [kind, setKind] = useState<'all' | 'mcq' | 'interview'>('all')
  const [level, setLevel] = useState<'all' | Level>('all')
  const [framing, setFraming] = useState<'mine' | 'all'>('mine')
  const [status, setStatus] = useState<Status>('all')
  const [tab, setTab] = useState<Tab>((params.get('mode') as Tab) || 'random')
  const [data, setData] = useState<Record<string, ChapterChecks>>({})
  const [size, setSize] = useState(10)
  const [drawn, setDrawn] = useState<Item[] | null>(null)
  const [pos, setPos] = useState(0)
  const [mistakeSnap, setMistakeSnap] = useState<string[] | null>(null)
  const { project } = useActiveProject()
  const answers = useProgress((s) => s.answers)
  const ratings = useProgress((s) => s.ratings)

  // load only the chapters that are selected
  useEffect(() => {
    let live = true
    Promise.all(chapters.filter((c) => !data[c]).map((c) => loadChecks(c).then((d) => [c, d] as const))).then((rows) => {
      if (live && rows.length) setData((old) => ({ ...old, ...Object.fromEntries(rows) }))
    })
    return () => {
      live = false
    }
  }, [chapters, data])

  useEffect(() => {
    const next = new URLSearchParams(params)
    next.set('mode', tab)
    if (chapters.length !== available.length) next.set('chapters', chapters.join(','))
    else next.delete('chapters')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, chapters])

  const pool: Item[] = useMemo(() => {
    const out: Item[] = []
    for (const ch of chapters) {
      const d = data[ch]
      if (!d) continue
      for (const [topic, sec] of Object.entries(d)) {
        if (kind !== 'interview' && level === 'all') for (const q of sec.mcq ?? []) out.push({ type: 'mcq', q, ch, topic })
        if (kind !== 'mcq')
          for (const q of sec.interview ?? []) {
            if (level !== 'all' && q.level !== level) continue
            if (q.project && framing === 'mine' && q.project !== project) continue
            out.push({ type: 'iv', q, ch, topic })
          }
      }
    }
    return out.filter((it) => {
      if (status === 'all') return true
      const done = it.type === 'mcq' ? answers[it.q.id] !== undefined : !!ratings[it.q.id]
      const wrong = it.type === 'mcq' ? isCorrect(it.q, answers[it.q.id]) === false : ratings[it.q.id] === 'missed'
      return status === 'new' ? !done : status === 'wrong' ? wrong : done
    })
  }, [chapters, data, kind, level, framing, project, status, answers, ratings])

  const loading = chapters.some((c) => !data[c])
  const counts = { mcq: pool.filter((i) => i.type === 'mcq').length, iv: pool.filter((i) => i.type === 'iv').length }

  const draw = () => {
    setDrawn(shuffle(pool).slice(0, size))
    setPos(0)
  }
  const mistakes = useMemo(() => {
    const ids = mistakeSnap
    const all = pool.filter((i) => i.type === 'mcq' && isCorrect(i.q, answers[i.q.id]) === false)
    return ids ? pool.filter((i) => ids.includes(i.q.id)) : all
  }, [pool, answers, mistakeSnap])
  const drill = useMemo(() => {
    const order: Record<string, number> = { none: 0, missed: 1, partly: 2, covered: 3 }
    return shuffle(pool.filter((i) => i.type === 'iv')).sort((a, b) => order[ratings[a.q.id] ?? 'none'] - order[ratings[b.q.id] ?? 'none'])
    // re-order only when the pool changes, not on every rating
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.length, chapters, kind, level, framing, project, status])
  const [drillPos, setDrillPos] = useState(0)

  const toggleCh = (id: string) => {
    setChapters((cs) => (cs.includes(id) ? cs.filter((c) => c !== id) : [...cs, id]))
  }

  const cur = drawn?.[pos]
  const drawnScore = drawn ? drawn.filter((i) => i.type === 'mcq' && isCorrect(i.q, answers[i.q.id])).length : 0
  const drawnMcq = drawn ? drawn.filter((i) => i.type === 'mcq').length : 0

  return (
    <div className="practice-page">
      <span className="c-kicker">Interview preparation · whole course</span>
      <h1 className="page-h"><Dumbbell size={28} /> Practice</h1>
      <p className="muted lead">
        Drill the chapter check questions across the course. Everything you answer here also counts on each chapter's check page and on your progress page.
      </p>

      <section className="pf" aria-label="Filters">
        <div className="pf-row">
          <span className="pf-l"><Filter size={14} /> Chapters</span>
          <button type="button" className="linkish" onClick={() => setChapters(available.map((c) => c.id))}>All</button>
          <button type="button" className="linkish" onClick={() => setChapters([])}>None</button>
          <span className="muted small">{chapters.length} of {available.length} chapters</span>
          <div className="pf-chips">
            {available.map((c) => {
              const n = chapterCheckCount(c.id)
              return (
                <button key={c.id} type="button" className={'lchip' + (chapters.includes(c.id) ? ' on' : '')} aria-pressed={chapters.includes(c.id)} onClick={() => toggleCh(c.id)} title={`${c.title} · ${n.mcq + n.interview} questions`}>
                  {c.num}
                </button>
              )
            })}
          </div>
        </div>
        <div className="pf-row">
          <label>Type
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="all">Both</option>
              <option value="mcq">Choose the answer</option>
              <option value="interview">Interview</option>
            </select>
          </label>
          <label>Level
            <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
              <option value="all">Any</option>
              {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]} (interview)</option>)}
            </select>
          </label>
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              <option value="all">All</option>
              <option value="new">Not tried yet</option>
              <option value="wrong">Wrong or missed before</option>
              <option value="practised">Already tried</option>
            </select>
          </label>
          <label>Project framing
            <select value={framing} onChange={(e) => setFraming(e.target.value as typeof framing)}>
              <option value="mine">Unframed + my project</option>
              <option value="all">All projects</option>
            </select>
          </label>
          <ProjectFramingNote />
        </div>
        <p className="pf-count" aria-live="polite">
          {loading ? 'Loading questions…' : `${counts.mcq} choose-the-answer and ${counts.iv} interview questions match.`}
        </p>
      </section>

      <div className="seg tabs" role="tablist" aria-label="Practice mode" onKeyDown={onRovingKeyDown}>
        <button role="tab" type="button" id="pm-tab-random" aria-selected={tab === 'random'} aria-controls={tab === 'random' ? 'pm-panel' : undefined} tabIndex={tab === 'random' ? 0 : -1} className={tab === 'random' ? 'on' : ''} onClick={() => setTab('random')}><Shuffle size={15} /> Random set</button>
        <button role="tab" type="button" id="pm-tab-mistakes" aria-selected={tab === 'mistakes'} aria-controls={tab === 'mistakes' ? 'pm-panel' : undefined} tabIndex={tab === 'mistakes' ? 0 : -1} className={tab === 'mistakes' ? 'on' : ''} onClick={() => { setTab('mistakes'); setMistakeSnap(null) }}><Target size={15} /> Review mistakes</button>
        <button role="tab" type="button" id="pm-tab-drill" aria-selected={tab === 'drill'} aria-controls={tab === 'drill' ? 'pm-panel' : undefined} tabIndex={tab === 'drill' ? 0 : -1} className={tab === 'drill' ? 'on' : ''} onClick={() => { setTab('drill'); setDrillPos(0) }}><MessagesSquare size={15} /> Interview drill</button>
      </div>

      {tab === 'random' && (
        <section className="pm" role="tabpanel" id="pm-panel" aria-labelledby={`pm-tab-${tab}`}>
          <div className="pm-bar">
            <label>Questions
              <select value={size} onChange={(e) => setSize(+e.target.value)}>
                {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button type="button" className="btn primary" onClick={draw} disabled={!pool.length}><Shuffle size={15} /> {drawn ? 'Draw a new set' : 'Draw a set'}</button>
            {drawn && <span className="muted">{drawnScore}/{drawnMcq} correct so far</span>}
          </div>
          {!drawn && <p className="muted">Draw a set to start. Questions come from the filters above, in random order.</p>}
          {drawn && cur && (
            <>
              <div className="pm-prog" aria-label={`Question ${pos + 1} of ${drawn.length}`}>
                {drawn.map((it, i) => {
                  const st = it.type === 'mcq' ? (answers[it.q.id] === undefined ? '' : isCorrect(it.q, answers[it.q.id]) ? 'ok' : 'bad') : ratings[it.q.id] ? 'ok' : ''
                  return <button key={it.q.id} type="button" className={(i === pos ? 'cur ' : '') + st} onClick={() => setPos(i)} aria-label={`Question ${i + 1}`} />
                })}
              </div>
              <div className="pm-card" key={cur.q.id}>
                {cur.type === 'mcq' ? <McqCard topLevel q={cur.q} mode="practice" context={<Ctx it={cur} />} /> : <InterviewCard topLevel q={cur.q} context={<Ctx it={cur} />} />}
              </div>
              <div className="pm-nav">
                <button type="button" className="btn" disabled={pos === 0} onClick={() => setPos((p) => p - 1)}><ArrowLeft size={15} /> Previous</button>
                <span className="muted">{pos + 1} / {drawn.length}</span>
                {pos < drawn.length - 1 ? (
                  <button type="button" className="btn primary" onClick={() => setPos((p) => p + 1)}>Next <ArrowRight size={15} /></button>
                ) : (
                  <button type="button" className="btn primary" onClick={draw}><RotateCcw size={15} /> New set</button>
                )}
              </div>
              {pos === drawn.length - 1 && (
                <p className="pm-sum">Set score: <b>{drawnScore}/{drawnMcq}</b> choose-the-answer correct{drawn.length > drawnMcq ? `, ${drawn.filter((i) => i.type === 'iv' && ratings[i.q.id]).length}/${drawn.length - drawnMcq} interview questions rated` : ''}.</p>
              )}
            </>
          )}
        </section>
      )}

      {tab === 'mistakes' && (
        <section className="pm" role="tabpanel" id="pm-panel" aria-labelledby={`pm-tab-${tab}`}>
          {mistakes.length ? (
            <>
              <p className="muted">
                {mistakes.length} {mistakes.length === 1 ? 'question' : 'questions'} you answered wrongly. Press “Try again” on each card; the list stays until you{' '}
                <button type="button" className="linkish" onClick={() => setMistakeSnap(null)}>refresh it</button>.
              </p>
              <div className="cards" onClickCapture={() => mistakeSnap === null && setMistakeSnap(mistakes.map((m) => m.q.id))}>
                {mistakes.map((it) => it.type === 'mcq' && <McqCard topLevel key={it.q.id} q={it.q} mode="practice" context={<Ctx it={it} />} />)}
              </div>
            </>
          ) : (
            <p className="muted">No mistakes to review in these chapters. Answer some questions in a random set or on a chapter check page first.</p>
          )}
        </section>
      )}

      {tab === 'drill' && (
        <section className="pm" role="tabpanel" id="pm-panel" aria-labelledby={`pm-tab-${tab}`}>
          {drill.length ? (
            <>
              <p className="muted">One interview question at a time, unrated ones first. Answer out loud or in notes, then reveal the checklist and rate yourself.</p>
              <div className="pm-card" key={drill[drillPos % drill.length].q.id}>
                <InterviewCard topLevel q={drill[drillPos % drill.length].q as InterviewQ} context={<Ctx it={drill[drillPos % drill.length]} />} />
              </div>
              <div className="pm-nav">
                <button type="button" className="btn" disabled={drillPos === 0} onClick={() => setDrillPos((p) => p - 1)}><ArrowLeft size={15} /> Previous</button>
                <span className="muted">{(drillPos % drill.length) + 1} / {drill.length}</span>
                <button type="button" className="btn primary" onClick={() => setDrillPos((p) => p + 1)}>Next question <ArrowRight size={15} /></button>
              </div>
            </>
          ) : (
            <p className="muted">No interview questions match these filters yet.</p>
          )}
        </section>
      )}
    </div>
  )
}
