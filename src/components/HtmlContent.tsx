import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { resolveAnchor } from '../data/course'
import { mountLegacyWidgets, type LegacyHandle } from '../legacy/runtime'
import { useTheme } from '../store/theme'
import { widgets } from '../widgets/registry'

interface Slot { el: HTMLElement; name: string; props: Record<string, unknown>; key: string }

/**
 * Renders an HTML content fragment, then:
 *  - mounts React widgets into `<div data-widget="name" data-props='{...}'>` placeholders,
 *  - starts the v3 vanilla widgets found in the fragment (when `legacy` is on),
 *  - turns in-content "#id" links into app navigation.
 */
export function HtmlContent({ html, className, legacy = true }: { html: string; className?: string; legacy?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [slots, setSlots] = useState<Slot[]>([])
  const handle = useRef<LegacyHandle | null>(null)
  const themeVersion = useTheme((s) => s.version)
  const inner = useMemo(() => ({ __html: html }), [html])

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
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
    setSlots(found)
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
      {slots.map((s) => {
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
