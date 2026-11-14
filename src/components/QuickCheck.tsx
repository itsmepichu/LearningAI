import { useEffect, useState } from 'react'
import { CheckCircle2, Zap } from 'lucide-react'
import { sectionCheckCount } from '../data/course'
import { isCore, loadChecks, type Mcq } from '../data/checks'
import { useNearViewport } from '../widgets/kit/hooks'
import { useProgress } from '../store/progress'
import { McqCard } from './Checks'

/**
 * The topic's quick check: its core questions, in practice mode, saved with the same `answer` action and question ids as the
 * chapter check page. The chapter's questions file loads only when this block nears the viewport.
 */
export function QuickCheck({ chapterId, topicId }: { chapterId: string; topicId: string }) {
  const n = sectionCheckCount(chapterId, topicId)
  const [ref, near] = useNearViewport<HTMLElement>('400px')
  const [qs, setQs] = useState<{ id: string; list: Mcq[] } | null>(null)
  const answers = useProgress((s) => s.answers)
  const results = useProgress((s) => s.results)

  useEffect(() => {
    if (!near || n.core === 0) return
    let live = true
    loadChecks(chapterId).then((c) => live && setQs({ id: topicId, list: (c[topicId]?.mcq ?? []).filter(isCore) }))
    return () => {
      live = false
    }
  }, [near, chapterId, topicId, n.core])

  // A topic with no core questions, such as the capstone's, shows no quick check.
  if (n.core === 0) return null
  const list = qs && qs.id === topicId ? qs.list : null
  const done = list ? list.filter((q) => answers[q.id] !== undefined).length : 0
  const right = list ? list.filter((q) => results[q.id]).length : 0

  return (
    <section ref={ref} className="quickcheck" aria-labelledby={`${topicId}-qc`}>
      <header className="qc-head">
        <h2 id={`${topicId}-qc`}><Zap size={18} /> Quick check <small>{n.core} questions, about {n.core} minutes</small></h2>
        {list && done === list.length && (
          <span className="qc-done"><CheckCircle2 size={16} /> {right} of {list.length} right</span>
        )}
      </header>
      {list ? (
        <div className="cards">
          {list.map((q, i) => <McqCard key={q.id} q={q} mode="practice" index={i} heading="h3" />)}
        </div>
      ) : (
        <div className="skeleton qc-wait" aria-busy="true"><i /><i className="tall" /></div>
      )}
    </section>
  )
}
