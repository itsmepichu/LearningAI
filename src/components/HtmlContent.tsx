import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { resolveAnchor } from '../data/course'
import { mountLegacyWidgets, type LegacyHandle } from '../legacy/runtime'
import { useTheme } from '../store/theme'
import { widgets } from '../widgets/registry'
import { termId } from '../data/glossary'
import { GlossaryTip } from './GlossaryTip'
import { renderMath } from './math'

interface Slot { el: HTMLElement; name: string; props: Record<string, unknown>; key: string }

/**
 * Content fragments choose heading levels for their look (mostly h5, with h3 for tool
 * lists), so rendered as written they skip levels below the page's h1. This gives them
 * a valid outline: a heading sits one level below the nearest earlier heading with a
 * higher source level, or at h2 if there is none. A changed heading gets an `as-hN`
 * class naming its source level, and the stylesheets style `hN` and `.as-hN` alike.
 * Running it again changes nothing.
 */
function normaliseHeadings(root: HTMLElement) {
  const open: { from: number; to: number }[] = []
  for (const h of root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')) {
    const from = +h.tagName[1]
    while (open.length && open[open.length - 1].from >= from) open.pop()
    const to = open.length ? open[open.length - 1].to + 1 : 2
    open.push({ from, to })
    if (to === from) continue
    const n = document.createElement('h' + to)
    for (const a of h.attributes) n.setAttribute(a.name, a.value)
    n.classList.add('as-h' + from)
    n.append(...h.childNodes)
    h.replaceWith(n)
  }
}

/**
 * Renders an HTML content fragment, then:
 *  - mounts React widgets into `<div data-widget="name" data-props='{...}'>` placeholders,
 *  - starts the v3 vanilla widgets found in the fragment (when `legacy` is on),
 *  - turns in-content "#id" links into app navigation,
 *  - normalises heading levels, before the legacy widgets look for headings,
 *  - typesets `.math` TeX with KaTeX, and shows glossary cards for `a.gl` term links.
 */
export function HtmlContent({
  html,
  className,
  legacy = true,
  slots,
}: {
  html: string
  className?: string
  legacy?: boolean
  /** React content for `<div data-slot="name">` placeholders in the fragment. */
  slots?: Record<string, ReactNode>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [widgetSlots, setWidgetSlots] = useState<Slot[]>([])
  const [slotEls, setSlotEls] = useState<{ name: string; el: HTMLElement }[]>([])
  const [rootEl, setRootEl] = useState<HTMLElement | null>(null)
  const handle = useRef<LegacyHandle | null>(null)
  const themeVersion = useTheme((s) => s.version)
  const inner = useMemo(() => ({ __html: html }), [html])

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    normaliseHeadings(root)
    setRootEl(root)
    renderMath(root).catch(() => {
      /* the raw TeX stays readable if KaTeX cannot load */
    })
    root.querySelectorAll<HTMLAnchorElement>('a[href^="http"]').forEach((a) => {
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
    })
    const found: Slot[] = []
    root.querySelectorAll<HTMLElement>('[data-widget]').forEach((el, i) => {
      let props: Record<string, unknown> = {}
      try {
        props = el.dataset.props ? JSON.parse(el.dataset.props) : {}
      } catch {
        /* malformed props: render with defaults */
      }
      found.push({ el, name: el.dataset.widget!, props, key: `${el.dataset.widget}-${i}` })
    })
    setWidgetSlots(found)
    setSlotEls([...root.querySelectorAll<HTMLElement>('[data-slot]')].map((el) => ({ name: el.dataset.slot!, el })))
    let cancelled = false
    if (legacy) {
      mountLegacyWidgets(root).then((h) => {
        if (cancelled) h.dispose()
        else handle.current = h
      })
    }
    return () => {
      cancelled = true
      handle.current?.dispose()
      handle.current = null
    }
  }, [html, legacy])

  useEffect(() => {
    if (themeVersion) handle.current?.rerender()
  }, [themeVersion])

  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a')
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return
    const href = a.getAttribute('href') || ''
    if (!href.startsWith('#') || href.length < 2) return
    const term = termId(href)
    if (term) {
      e.preventDefault()
      navigate(`/glossary#gl-${term}`)
      return
    }
    const id = decodeURIComponent(href.slice(1))
    const local = document.getElementById(id)
    if (local && ref.current?.contains(local)) {
      e.preventDefault()
      local.scrollIntoView({ behavior: 'smooth', block: 'start' })
      history.replaceState(history.state, '', '#' + id)
      return
    }
    const to = resolveAnchor(id)
    if (to) {
      e.preventDefault()
      navigate(to)
    }
  }

  return (
    <>
      <div ref={ref} className={className} onClick={onClick} dangerouslySetInnerHTML={inner} />
      <GlossaryTip root={rootEl} />
      {slotEls.map((s, i) => (slots?.[s.name] ? createPortal(slots[s.name], s.el, `slot-${s.name}-${i}`) : null))}
      {widgetSlots.map((s) => {
        const W = widgets[s.name]
        return createPortal(
          W ? (
            <Suspense fallback={<div className="widget-loading">Loading interactive…</div>}>
              <W {...s.props} />
            </Suspense>
          ) : (
            <div className="widget-loading">Unknown widget “{s.name}”</div>
          ),
          s.el,
          s.key,
        )
      })}
    </>
  )
}
