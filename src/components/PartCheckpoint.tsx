import { Link } from 'react-router'
import { ClipboardCheck, Flag } from 'lucide-react'
import { parts } from '../data/course'
import { PART_REVIEW_SIZE } from '../data/partReview'
import { labItemsOf, milestonesOf, partEndingAt } from '../data/evidence'
import { useProgress } from '../store/progress'

/** Shown on the last chapter page of each part: the part review, the milestones and the Evidence page as the next required step. */
export function PartCheckpoint({ chapterId }: { chapterId: string }) {
  const part = partEndingAt(chapterId)
  const evidence = useProgress((s) => s.evidence)
  const workshopDone = useProgress((s) => s.workshopDone)
  if (!part) return null
  const milestones = milestonesOf(part.id)
  const labs = labItemsOf(part.id)
  const last = part.id === parts.filter((p) => p.id !== 'res').slice(-1)[0].id
  return (
    <section className="partcp" aria-labelledby="partcp-h" id="part-checkpoint">
      <span className="eyebrow-sm"><Flag size={14} /> Next required step</span>
      <h2 id="partcp-h">{part.label} checkpoint</h2>
      <p className="muted">Before you start the next part, review what {part.label} taught{milestones.length ? ' and keep its milestone evidence' : ''}.</p>
      <ol className="partcp-steps">
        <li>
          <b>Part review.</b> {PART_REVIEW_SIZE} mixed questions across this part's chapters, core questions first.{' '}
          <Link className="btn primary" to={`/practice?part=${part.id}`}>Start the {part.label} review</Link>
        </li>
        {milestones.length > 0 ? (
          <li>
            <b>{milestones.length === 1 ? 'Milestone' : 'Milestones'}.</b>
            {part.id === 'p1' && ` The tiny language model from chapter 1 and the ${labs.length} Part I lab deliverables.`}
            <ul>
              {milestones.map((m) => (
                <li key={m.id}>
                  <Link to={`/evidence#ev-${m.id}`}>{m.title}</Link>
                  {evidence[m.id]?.done ? ' · kept' : ''}
                </li>
              ))}
            </ul>
          </li>
        ) : (
          <li><b>No new milestone.</b> Part V adds breadth and governance; its lab deliverables are on the Evidence page.</li>
        )}
        <li>
          <b>Evidence.</b> {labs.filter((l) => workshopDone[l.id]).length} of {labs.length} chapter lab deliverables kept in this part.{' '}
          <Link className="btn" to="/evidence"><ClipboardCheck size={14} /> Open Evidence</Link>
        </li>
        {last && <li><b>Then the capstone.</b> <Link to="/capstone">Open the capstone</Link> and build the milestones in order.</li>}
      </ol>
    </section>
  )
}
