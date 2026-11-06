import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getTopic } from '../data/course'
import { loadGlossary, termId, type Glossary } from '../data/glossary'

interface Open {
  id: string
  anchor: HTMLElement
}

const TIP_ID = 'gl-tip'

/**
 * The definition card for glossary links inside `root`. It appears on hover or keyboard focus and meets WCAG 1.4.13:
 * Escape dismisses it, the pointer can move onto it without it closing, and it stays until the pointer or focus leaves.
 * The card is a tooltip (text only); the link itself goes to the full entry on the glossary page.
 */
export function GlossaryTip({ root }: { root: HTMLElement | null }) {
  const [open, setOpen] = useState<Open | null>(null)
  const [glossary, setGlossary] = useState<Glossary | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const tip = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!root) return
    const cancelClose = () => window.clearTimeout(closeTimer.current)
    const closeSoon = () => {
      cancelClose()
      closeTimer.current = window.setTimeout(() => setOpen(null), 150)
    }
    const show = (a: HTMLElement) => {
      const id = termId(a.getAttribute('href'))
      if (!id) return
      cancelClose()
      loadGlossary().then(setGlossary)
      setOpen((o) => (o?.anchor === a ? o : { id, anchor: a }))
    }
    const link = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('a.gl') : null)
    const over = (e: Event) => {
      const a = link(e.target)
      if (a) show(a)
    }
    const out = (e: Event) => {
      if (link(e.target)) closeSoon()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    root.addEventListener('pointerover', over)
    root.addEventListener('pointerout', out)
    root.addEventListener('focusin', over)
    root.addEventListener('focusout', out)
    document.addEventListener('keydown', key)
    return () => {
      cancelClose()
      root.removeEventListener('pointerover', over)
      root.removeEventListener('pointerout', out)
      root.removeEventListener('focusin', over)
      root.removeEventListener('focusout', out)
      document.removeEventListener('keydown', key)
    }
  }, [root])

  // Tie the link to the card for screen readers while it is shown.
  useEffect(() => {
    if (!open) return
    open.anchor.setAttribute('aria-describedby', TIP_ID)
    return () => open.anchor.removeAttribute('aria-describedby')
  }, [open])

  // Place the card under the term, or above it near the bottom of the window, inside a 16 px gutter.
  useLayoutEffect(() => {
    if (!open || !tip.current) return setPos(null)
    const place = () => {
      const r = open.anchor.getBoundingClientRect()
      const w = tip.current!.offsetWidth
      const h = tip.current!.offsetHeight
      const above = r.bottom + 8 + h > window.innerHeight - 16 && r.top - 8 - h > 16
      const left = Math.min(Math.max(16, r.left), window.innerWidth - 16 - w)
      setPos({ left, top: above ? r.top - 8 - h : r.bottom + 8, above })
    }
    place()
    addEventListener('scroll', place, { passive: true, capture: true })
    addEventListener('resize', place)
    return () => {
      removeEventListener('scroll', place, { capture: true })
      removeEventListener('resize', place)
    }
  }, [open, glossary])

  if (!open) return null
  const entry = glossary?.[open.id]
  const topic = entry ? getTopic(entry.topic) : undefined
  return createPortal(
    <div
      ref={tip}
      id={TIP_ID}
      role="tooltip"
      className={'gl-tip' + (pos?.above ? ' above' : '')}
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}
      onPointerEnter={() => window.clearTimeout(closeTimer.current)}
      onPointerLeave={() => setOpen(null)}
    >
      {entry ? (
        <>
          <b>{entry.term}</b>
          <span>{entry.def}</span>
          {topic && (
            <small>
              Taught in {topic.tn} {topic.title}
            </small>
          )}
        </>
      ) : (
        <span>{glossary ? 'This term is missing from the glossary.' : 'Loading…'}</span>
      )}
    </div>,
    document.body,
  )
}
