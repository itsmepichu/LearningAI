import { useEffect, useId, useRef, useState } from 'react'
import { Building2, Check, ChevronDown, Landmark, Plane, ShoppingBag } from 'lucide-react'
import { projects, type ProjectId } from '../data/projects'
import { useProgress } from '../store/progress'

const ICONS = { building: Building2, 'shopping-bag': ShoppingBag, landmark: Landmark, plane: Plane } as const

export function ProjectIcon({ id, size = 15 }: { id: ProjectId; size?: number }) {
  const p = projects.find((x) => x.id === id)!
  const I = ICONS[p.icon as keyof typeof ICONS] ?? Building2
  return <I size={size} aria-hidden="true" />
}

/** Compact picker for the example project. `inline` renders as a text-style button for prose lines. */
export function ProjectPicker({ inline = false }: { inline?: boolean }) {
  const project = useProgress((s) => s.project)
  const setProject = useProgress((s) => s.setProject)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listId = useId()
  const current = projects.find((p) => p.id === project)!

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    addEventListener('mousedown', close)
    addEventListener('keydown', close)
    return () => {
      removeEventListener('mousedown', close)
      removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div className={'pp' + (inline ? ' inline' : '')} ref={ref}>
      <button
        type="button"
        className="pp-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        title="Example project used for practical notes, data and labs"
        style={{ ['--pc' as string]: `var(${current.accent})` }}
      >
        <span className="pp-ico"><ProjectIcon id={current.id} /></span>
        <span className="pp-lbl">{inline ? current.label : <><small>Example</small>{current.label}</>}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="pp-menu" role="listbox" id={listId} aria-label="Example project">
          <div className="pp-h">Example project</div>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={p.id === project}
              className={'pp-opt' + (p.id === project ? ' on' : '')}
              style={{ ['--pc' as string]: `var(${p.accent})` }}
              onClick={() => {
                setProject(p.id)
                setOpen(false)
              }}
            >
              <span className="pp-ico"><ProjectIcon id={p.id} /></span>
              <span className="pp-b">
                <b>{p.label} <small>· {p.company}</small></b>
                <span>{p.teaches}</span>
              </span>
              {p.id === project && <Check size={15} className="pp-ok" />}
            </button>
          ))}
          <p className="pp-foot">Changes the practical notes, datasets and lab scenarios. All companies and figures are fictional.</p>
        </div>
      )}
    </div>
  )
}
