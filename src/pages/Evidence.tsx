import { Link } from 'react-router'
import { ClipboardCheck } from 'lucide-react'
import { parts } from '../data/course'
import { labItems, labItemsOf, milestoneItems, type EvidenceItem } from '../data/evidence'
import { useDocumentTitle } from '../components/common'
import { useProgress } from '../store/progress'

const isUrl = (s: string) => /^https?:\/\/\S+$/.test(s.trim())

/** The tick, the title and a short note or link for one item. A lab item's tick is the chapter's workshop-done state. */
export function EvidenceRow({ item }: { item: EvidenceItem }) {
  const lab = item.kind === 'lab'
  const done = useProgress((s) => (lab ? !!s.workshopDone[item.id] : !!s.evidence[item.id]?.done))
  const note = useProgress((s) => s.evidence[item.id]?.note ?? '')
  const setWorkshopDone = useProgress((s) => s.setWorkshopDone)
  const setEvidenceDone = useProgress((s) => s.setEvidenceDone)
  const setEvidenceNote = useProgress((s) => s.setEvidenceNote)
  return (
    <li className={'ev-item' + (done ? ' done' : '')} id={`ev-${item.id}`}>
      <label className="ev-tick">
        <input type="checkbox" checked={done} onChange={(e) => (lab ? setWorkshopDone(item.id, e.target.checked) : setEvidenceDone(item.id, e.target.checked))} />
        <span className="sr-only">{item.title}: kept as evidence</span>
      </label>
      <div className="ev-b">
        <h3><Link to={item.to}>{item.title}</Link></h3>
        {item.build && <p className="muted small"><b>Build</b> {item.build}</p>}
        <p><b>Keep as evidence</b> {item.keep}</p>
        <p><b>Pass condition</b> {item.pass}</p>
        <div className="ev-note">
          <input
            type="text"
            value={note}
            maxLength={300}
            placeholder="Optional short note or link, for example where the files are"
            aria-label={`Note or link for ${item.title}`}
            onChange={(e) => setEvidenceNote(item.id, e.target.value)}
          />
          {isUrl(note) && <a href={note.trim()} target="_blank" rel="noreferrer">Open ↗</a>}
        </div>
      </div>
    </li>
  )
}

export function EvidencePage() {
  useDocumentTitle('Evidence')
  const workshopDone = useProgress((s) => s.workshopDone)
  const evidence = useProgress((s) => s.evidence)
  const kept = labItems.filter((l) => workshopDone[l.id]).length + milestoneItems.filter((m) => evidence[m.id]?.done).length
  const total = labItems.length + milestoneItems.length
  return (
    <div className="page-narrow evidence-page">
      <span className="c-kicker">Stored only in this browser</span>
      <h1 className="page-h"><ClipboardCheck size={28} /> Evidence</h1>
      <p className="muted lead">
        What to keep from each chapter lab, and from the capstone milestones, so you can show your work in an interview or a design review.
        Tick an item when you have kept the evidence and it meets its pass condition; add a short note or a link if it helps you find it again.
        A lab's tick is the same as <b>Workshop done</b> on its workshop page. Nothing here is sent anywhere: ticks and notes are saved in this browser only.
      </p>
      <p className="ev-sum" aria-live="polite"><b>{kept}</b> of {total} items kept.</p>

      <h2>Capstone milestones</h2>
      <p className="muted">The capstone is built in eight milestones, each ending with its evidence and a pass condition. Milestone 0 is the warm-up from Part I. See the <Link to="/capstone">capstone</Link>.</p>
      <ol className="ev-list">{milestoneItems.map((m) => <EvidenceRow key={m.id} item={m} />)}</ol>

      <h2>Chapter labs</h2>
      {parts.filter((p) => p.id !== 'res').map((p) => (
        <section key={p.id} aria-label={`${p.label} labs`}>
          <h3 className="ev-part">{p.label} · {p.title}</h3>
          <ol className="ev-list">{labItemsOf(p.id).map((l) => <EvidenceRow key={l.id} item={l} />)}</ol>
        </section>
      ))}
    </div>
  )
}
