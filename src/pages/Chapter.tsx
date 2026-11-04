import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, Check, Clock, FlaskConical, ListChecks, MousePointerClick } from 'lucide-react'
import { chapterCheckCount, getChapter, minutes, partOf } from '../data/course'
import { LabVariant, useChapterPractice } from '../components/Practice'
import { HtmlContent } from '../components/HtmlContent'
import { Tags, useDocumentTitle, usePage } from '../components/common'
import { ProgressRing } from '../components/Icons'
import { useProgress } from '../store/progress'
import { NotFound } from './NotFound'

const WWW = [
  ['what', 'What it is'],
  ['why', 'Why we study it'],
  ['where', 'Where it applies'],
] as const

export function ChapterPage() {
  const { chapterId } = useParams()
  const ch = getChapter(chapterId)
  const loc = useLocation()
  const intro = usePage(chapterId, '_intro', !!ch?.hasIntro)
  const outro = usePage(chapterId, '_outro', !!ch?.hasOutro)
  const lab = usePage(chapterId, '_lab', !!ch?.hasLab)
  const studied = useProgress((s) => s.studied)
  const setMany = useProgress((s) => s.setMany)
  const practice = useChapterPractice(chapterId)
  useDocumentTitle(ch ? `${ch.num} ${ch.title}` : 'Not found')

  const ready = (!ch?.hasLab || lab !== null) && (!ch?.hasOutro || outro !== null)
  useEffect(() => {
    if (!ready) return
    if (loc.hash) document.getElementById(loc.hash.slice(1))?.scrollIntoView({ block: 'start' })
    else window.scrollTo({ top: 0 })
  }, [ready, loc.hash, chapterId])

  if (!ch) return <NotFound />
  const part = partOf(ch)
  const ids = ch.topics.map((t) => t.id)
  const n = ids.filter((i) => studied[i]).length
  const all = n === ids.length
  const mins = ch.topics.reduce((a, t) => a + minutes(t), 0)
  const inter = ch.topics.reduce((a, t) => a + t.interactive, 0)
  const firstOpen = ch.topics.find((t) => !studied[t.id]) ?? ch.topics[0]

  return (
    <div className={'chapter-page kind-' + ch.kind}>
      <motion.header className="c-head" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} key={ch.id}>
        <div className="c-num" aria-hidden="true">{ch.num}</div>
        <div className="c-titles">
          <span className="c-kicker">
            {part?.label} · {ch.kind === 'chapter' ? `Chapter ${ch.num}` : ch.kind === 'capstone' ? 'Capstone project' : `Appendix ${ch.num}`}
          </span>
          <h1>{ch.title}</h1>
        </div>
        <p className="c-lede" dangerouslySetInnerHTML={{ __html: ch.lede }} />
        <div className="c-stats">
          <div className="c-ring">
            <ProgressRing value={n / ids.length} size={52} stroke={5} />
            <span>
              <b>{n}/{ids.length}</b> topics studied
            </span>
          </div>
          <span><Clock size={15} /> about {Math.round(mins / 5) * 5} min</span>
          {inter > 0 && <span><MousePointerClick size={15} /> {inter} interactive figures</span>}
          {ch.hasLab && <a href="#lab" onClick={(e) => { e.preventDefault(); document.getElementById('lab')?.scrollIntoView({ behavior: 'smooth' }) }}><FlaskConical size={15} /> Lab</a>}
          {ch.kind === 'chapter' && <Link to={`/${ch.id}/check`}><ListChecks size={15} /> Chapter check</Link>}
          {firstOpen && (
            <Link className="btn primary" to={`/${ch.id}/${firstOpen.id}`}>
              {n === 0 ? 'Start chapter' : all ? 'Review chapter' : 'Continue'} <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </motion.header>

      {Object.keys(ch.www).length > 0 && (
        <div className="www">
          {WWW.map(([k, label]) =>
            ch.www[k] ? (
              <div key={k}>
                <h4>{label}</h4>
                <p dangerouslySetInnerHTML={{ __html: ch.www[k]!.replace(/^<p>|<\/p>$/g, '') }} />
              </div>
            ) : null,
          )}
        </div>
      )}

      {intro && <HtmlContent html={intro} className="topic lai-topic c-intro" />}

      <h2 className="c-sec">Topics in this {ch.kind === 'chapter' ? 'chapter' : 'section'}</h2>
      <ol className="topic-cards">
        {ch.topics.map((t, i) => (
          <motion.li key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i, duration: 0.3 }}>
            <Link to={`/${ch.id}/${t.id}`} className={'tcard' + (studied[t.id] ? ' done' : '')}>
              <span className="tcard-n">{t.tn}</span>
              <b>{t.title}</b>
              <span className="tcard-meta">
                <span>{minutes(t)} min</span>
                {t.interactive > 0 && <span>{t.interactive} interactive</span>}
                <Tags tags={t.tags} />
              </span>
              {studied[t.id] && <Check className="tcard-ok" size={16} aria-label="studied" />}
            </Link>
          </motion.li>
        ))}
      </ol>

      {outro && <HtmlContent html={outro} className="topic lai-topic c-outro" />}

      {lab && (
        <div id="lab" className="c-lab">
          <HtmlContent html={lab} className="lai-lab" legacy={false} />
          <LabVariant practice={practice} />
        </div>
      )}
      {ch.kind === 'chapter' && <ChapterCheckCard chapterId={ch.id} num={ch.num} />}

      {ids.length > 0 && (
        <div className="chdone2">
          <button type="button" className="btn" onClick={() => setMany(ids, !all)}>
            <Check size={15} /> {all ? 'Clear chapter progress' : 'Mark whole chapter studied'}
          </button>
          <span className="muted">{n} of {ids.length} topics marked studied</span>
        </div>
      )}
    </div>
  )
}

function ChapterCheckCard({ chapterId, num }: { chapterId: string; num: string }) {
  const n = chapterCheckCount(chapterId)
  return (
    <Link to={`/${chapterId}/check`} className="checkcard" id="quiz">
      <span className="checkcard-ic"><ListChecks size={26} /></span>
      <span className="checkcard-b">
        <span className="eyebrow-sm">End of chapter {num}</span>
        <b>Chapter {num} check</b>
        <small>
          {n.mcq} choose-the-answer · {n.interview} interview questions, grouped by section. Practice or check mode.
        </small>
      </span>
      <ArrowRight size={20} />
    </Link>
  )
}
