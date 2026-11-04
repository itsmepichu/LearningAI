import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { Check, ChevronRight } from 'lucide-react'
import { chapters, getChapter, parts } from '../data/course'
import { useProgress } from '../store/progress'

export function Sidebar() {
  const loc = useLocation()
  const current = loc.pathname.split('/')[1]
  const studied = useProgress((s) => s.studied)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (current) setOpen((o) => ({ ...o, [current]: true }))
    // keep the active link in view inside the rail
    requestAnimationFrame(() => listRef.current?.querySelector('a.active')?.scrollIntoView({ block: 'nearest' }))
  }, [current, loc.pathname])

  return (
    <div className="side-list" ref={listRef}>
      <NavLink to="/" end className="side-top">
        Overview
      </NavLink>
      <NavLink to="/guide" className="side-top">
        How to use this manual
      </NavLink>
      <NavLink to="/paths" className="side-top">
        Learning paths
      </NavLink>
      <NavLink to="/practice" className="side-top">
        Practice
      </NavLink>
      {parts.map((p) => (
        <div key={p.id} className="side-part">
          <div className="side-part-h">
            {p.label} <span>· {p.title}</span>
          </div>
          {p.chapters.map((cid) => {
            const c = getChapter(cid) ?? chapters[0]
            const ids = c.topics.map((t) => t.id)
            const n = ids.filter((i) => studied[i]).length
            const isOpen = !!open[c.id]
            return (
              <div key={c.id} className={'side-ch' + (current === c.id ? ' current' : '')}>
                <div className="side-ch-row">
                  <NavLink to={`/${c.id}`} end className="side-ch-link">
                    <span className="n">{c.num}</span>
                    <span className="t">{c.title}</span>
                    {n > 0 && n === ids.length && <Check size={14} className="ok" aria-label="studied" />}
                  </NavLink>
                  <button
                    type="button"
                    className={'side-exp' + (isOpen ? ' on' : '')}
                    aria-label={(isOpen ? 'Collapse ' : 'Expand ') + c.title}
                    aria-expanded={isOpen}
                    onClick={() => setOpen((o) => ({ ...o, [c.id]: !isOpen }))}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
                {c.kind === 'chapter' && n > 0 && (
                  <div className="side-bar" aria-hidden="true">
                    <i style={{ width: `${(n / ids.length) * 100}%` }} />
                  </div>
                )}
                {isOpen && (
                  <ol className="side-topics">
                    {c.topics.map((t) => (
                      <li key={t.id}>
                        <NavLink to={`/${c.id}/${t.id}`} className={studied[t.id] ? 'done' : ''}>
                          <span className="n">{t.tn}</span>
                          <span className="t">{t.title}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
