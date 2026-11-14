import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, BookOpen, Compass, Dumbbell, FlaskConical, MousePointerClick } from 'lucide-react'
import { ProjectPicker } from '../components/ProjectPicker'
import { chapters, courseTopics, getChapter, getTopic, parts, totals } from '../data/course'
import { ProgressRing } from '../components/Icons'
import { useDocumentTitle, useNextTopic } from '../components/common'
import { useProgress } from '../store/progress'

const PART_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight']

export function Home() {
  useDocumentTitle('')
  const studied = useProgress((s) => s.studied)
  const last = useProgress((s) => s.last)
  const done = courseTopics.filter((t) => studied[t.id]).length
  const nextTopic = useNextTopic()
  const mainParts = parts.filter((p) => p.id !== 'res').length
  const lastTopic = last ? getTopic(last.split('/')[2]) : undefined

  return (
    <div className="home">
      <section className="hero2">
        <motion.div className="hero-copy" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="eyebrow">{totals.chapters} chapters · AI from foundations to production systems</span>
          <h1>
            <span>LearningAI</span>
          </h1>
          <p>
            An interactive course. For beginner programmers and students who know basic Python; it ends at building professional AI applications. It starts from what a token is and goes on through how models are trained and served, to building,
            evaluating, securing and operating AI systems that retrieve across millions of documents and serve millions of users. Every chapter,
            section and topic is required; the course takes a beginner to professional AI application building.
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
              <BookOpen size={16} /> How to use this course
            </Link>
          </div>
          <div className="hero-proj">
            Example project: <ProjectPicker inline />
          </div>
          <p className="muted hero-proj-note">Change it any time; the practical notes, data and labs follow it.</p>
        </motion.div>
        <motion.div className="hero-panel" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <div className="hp-ring">
            <ProgressRing value={done / totals.topics} size={112} stroke={9} />
            {done > 0 ? (
              <div>
                <b>{done}</b>
                <span>of {totals.topics} topics</span>
              </div>
            ) : (
              <div className="hp-zero">
                <span>No topics studied yet.</span>
                <Link className="btn sm" to={nextTopic.to}>{nextTopic.label}</Link>
              </div>
            )}
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
          <p>{PART_WORDS[mainParts] ?? mainParts} parts plus field resources, all of it required. Work through them in order, because each chapter builds on the ones before it. Evaluation starts in chapter 8 and every later chapter adds to it.</p>
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
                      {c.kind !== 'appendix' && (
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

      <section className="home-sec labels-sec">
        <div className="sec-title">
          <MousePointerClick size={18} />
          <h2>What the labels mean</h2>
        </div>
        <div className="label-grid">
          <div><span className="tag cpu">Laptop · CPU</span><p>You can run this on an ordinary laptop with no dedicated GPU. Expect 8–16 GB of RAM to be enough unless stated otherwise.</p></div>
          <div><span className="tag real">Runs in browser</span><p>The figure does real computation in this page (a real algorithm on real input), for example BPE merges, BM25 scoring or a tiny language model trained by counting.</p></div>
          <div><span className="tag sim">Simulation</span><p>An animated model of system behaviour. It shows the steps and the shape of the tradeoffs, using made-up but realistic numbers. No neural network is executed.</p></div>
          <div><span className="tag gpu">Colab · GPU</span><p>Needs one GPU. The page has a step-by-step Google Colab guide, with cells to copy and a notebook to download, that runs on a free Colab GPU. The code runs on Google's machines, not on this site, and free GPU access is limited and not guaranteed.</p></div>
          <div><span className="tag gpu">Needs external compute</span><p>Needs several GPUs at once or a cluster, which one Colab GPU cannot provide (for example DeepSpeed, Megatron-LM or a full nanochat run). Read the code and reports; where a single-GPU version teaches the idea, a Colab guide is linked.</p></div>
        </div>
        <p className="muted small">
          <FlaskConical size={13} /> {chapters.filter((c) => c.hasLab).length} chapter labs · written November 2026; tool versions change, so links point to official documentation.
        </p>
      </section>
    </div>
  )
}
