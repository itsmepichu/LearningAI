import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, BookOpen, Compass, Dumbbell, FlaskConical, MousePointerClick, Route as RouteIcon } from 'lucide-react'
import { ProjectPicker } from '../components/ProjectPicker'
import { chapters, courseTopics, getChapter, getTopic, parts, paths, totals } from '../data/course'
import { ProgressRing } from '../components/Icons'
import { useDocumentTitle } from '../components/common'
import { useProgress } from '../store/progress'

export function Home() {
  useDocumentTitle('')
  const studied = useProgress((s) => s.studied)
  const last = useProgress((s) => s.last)
  const done = courseTopics.filter((t) => studied[t.id]).length
  const lastTopic = last ? getTopic(last.split('/')[2]) : undefined

  return (
    <div className="home">
      <section className="hero2">
        <motion.div className="hero-copy" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="eyebrow">18 chapters · fundamentals → production systems</span>
          <h1>
            Enterprise AI
            <br />
            <span>Field Manual</span>
          </h1>
          <p>
            An interactive course for software engineers: from what a token is, through how models are trained and served, to building,
            evaluating, securing and operating AI systems that retrieve across millions of documents and serve millions of users.
          </p>
          <div className="hero-cta">
            {lastTopic ? (
              <Link className="btn primary lg" to={`/${lastTopic.chapter.id}/${lastTopic.id}`}>
                Continue · {lastTopic.tn} {lastTopic.title.length > 38 ? lastTopic.title.slice(0, 36) + '…' : lastTopic.title} <ArrowRight size={16} />
              </Link>
            ) : (
              <Link className="btn primary lg" to="/c1/c1-1">
                Start with chapter 1 <ArrowRight size={16} />
              </Link>
            )}
            <Link className="btn lg" to="/guide">
              <BookOpen size={16} /> How to use this manual
            </Link>
          </div>
          <div className="hero-proj">
            Example project: <ProjectPicker inline /> <span className="muted">· change it any time; the practical notes, data and labs follow it.</span>
          </div>
        </motion.div>
        <motion.div className="hero-panel" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <div className="hp-ring">
            <ProgressRing value={done / totals.topics} size={112} stroke={9} />
            <div>
              <b>{done}</b>
              <span>of {totals.topics} topics</span>
            </div>
          </div>
          <dl className="hp-stats">
            <div><dt>Chapters</dt><dd>{totals.chapters}</dd></div>
            <div><dt>Figures</dt><dd>{totals.figures}</dd></div>
            <div><dt>Interactive</dt><dd>{totals.interactive}</dd></div>
            <div><dt>Check questions</dt><dd>{totals.mcq + totals.interview}</dd></div>
          </dl>
          <div className="hp-links">
            <Link to="/progress" className="hp-link">
              Your progress <ArrowRight size={14} />
            </Link>
            <Link to="/practice" className="hp-link">
              <Dumbbell size={14} /> Practice for interviews <ArrowRight size={14} />
            </Link>
          </div>
        </motion.div>
      </section>

      <section className="home-sec">
        <div className="sec-title">
          <Compass size={18} />
          <h2>The course map</h2>
          <p>Four parts plus field resources. Evaluation starts in chapter 8 and every later chapter adds to it.</p>
        </div>
        <div className="part-grid">
          {parts.map((p, pi) => (
            <motion.div key={p.id} className={'part-col part-' + p.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: pi * 0.06, duration: 0.4 }}>
              <div className="part-h">
                <span>{p.label}</span>
                <b>{p.title}</b>
              </div>
              {p.chapters.map((cid) => {
                const c = getChapter(cid)!
                const n = c.topics.filter((t) => studied[t.id]).length
                const inter = c.topics.reduce((a, t) => a + t.interactive, 0)
                return (
                  <Link key={c.id} to={`/${c.id}`} className="ch-card">
                    <span className="ch-card-n">{c.num}</span>
                    <span className="ch-card-b">
                      <b>{c.title}</b>
                      <small>
                        {c.topics.length} topics{inter ? ` · ${inter} interactive` : ''}
                      </small>
                      {c.kind === 'chapter' && (
                        <span className="mini-bar" aria-label={`${n} of ${c.topics.length} studied`}>
                          <i style={{ width: `${(n / c.topics.length) * 100}%` }} />
                        </span>
                      )}
                    </span>
                  </Link>
                )
              })}
            </motion.div>
          ))}
        </div>
      </section>

      <section className="home-sec">
        <div className="sec-title">
          <RouteIcon size={18} />
          <h2>Pick a learning path</h2>
          <p>Each path is an ordered subset of chapters for a role. You can switch paths at any time; progress is shared.</p>
        </div>
        <div className="path-grid">
          {paths.map((p) => {
            const ids = p.chapters.flatMap((c) => getChapter(c)!.topics.map((t) => t.id))
            const n = ids.filter((i) => studied[i]).length
            return (
              <Link key={p.id} to={`/paths#${p.id}`} className="path-card">
                <span className="path-who">{p.who}</span>
                <b>{p.title}</b>
                <p>{p.blurb}</p>
                <span className="path-chs">
                  {p.chapters.map((c) => (
                    <i key={c}>{getChapter(c)!.num}</i>
                  ))}
                </span>
                <span className="mini-bar">
                  <i style={{ width: `${(n / ids.length) * 100}%` }} />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="home-sec labels-sec">
        <div className="sec-title">
          <MousePointerClick size={18} />
          <h2>What the labels mean</h2>
        </div>
        <div className="label-grid">
          <div><span className="tag cpu">Laptop · CPU</span><p>Runs on an ordinary laptop with no dedicated GPU; 8–16 GB RAM is enough unless stated.</p></div>
          <div><span className="tag real">Runs in browser</span><p>Real computation on this page: a real algorithm on real input, such as BPE merges or BM25 scoring.</p></div>
          <div><span className="tag sim">Simulation</span><p>An animated model of system behaviour with illustrative numbers. No neural network is executed.</p></div>
          <div><span className="tag gpu">Needs external compute</span><p>Realistic only with a GPU or cluster, e.g. Colab, Kaggle or an hourly cloud GPU.</p></div>
        </div>
        <p className="muted small">
          <FlaskConical size={13} /> {chapters.filter((c) => c.hasLab).length} chapter labs · written November 2026; tool versions change, so links point to official documentation.
        </p>
      </section>
    </div>
  )
}
