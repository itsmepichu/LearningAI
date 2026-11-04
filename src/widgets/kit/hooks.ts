import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { useActiveProject } from '../../components/Practice'
import { getProject, type Project } from '../../data/projects'

/** The example project this page shows, including a `?project=` override. */
export function useProject(): Project {
  return getProject(useActiveProject().project)!
}

const RM_QUERY = '(prefers-reduced-motion: reduce)'
const subscribeRm = (fn: () => void) => {
  const mq = matchMedia(RM_QUERY)
  mq.addEventListener('change', fn)
  return () => mq.removeEventListener('change', fn)
}

/** True while the reader asks for reduced motion. Widgets then show end states instead of animating. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeRm, () => matchMedia(RM_QUERY).matches)
}

/** Element width in CSS pixels, kept current as the layout changes. */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/** Becomes true once the element is near the viewport, and stays true. */
export function useNearViewport<T extends HTMLElement>(margin = '200px'): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true)
      },
      { rootMargin: margin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [margin, near])
  return [ref, near]
}
