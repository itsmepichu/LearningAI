import { useEffect, useState, type KeyboardEvent } from 'react'
import type { Tag } from '../data/course'
import { loadPage } from '../data/course'

const TAGS: Record<Tag, string> = { cpu: 'Laptop · CPU', real: 'Runs in browser', sim: 'Simulation', gpu: 'Needs external compute' }

export function Tags({ tags }: { tags: Tag[] }) {
  if (!tags.length) return null
  return (
    <span className="tags">
      {tags.map((t) => (
        <span key={t} className={'tag ' + t}>
          {TAGS[t]}
        </span>
      ))}
    </span>
  )
}

/**
 * Arrow keys for a tablist or radiogroup with a roving tabIndex. Clicking the next item
 * selects it through its own handler, so every list keeps its selection logic in one place.
 */
export function onRovingKeyDown(e: KeyboardEvent<HTMLElement>) {
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role=tab],[role=radio]')]
  const at = items.indexOf(document.activeElement as HTMLElement)
  if (at < 0) return
  const radio = items[at].getAttribute('role') === 'radio'
  const forward = e.key === 'ArrowRight' || (radio && e.key === 'ArrowDown')
  const back = e.key === 'ArrowLeft' || (radio && e.key === 'ArrowUp')
  const to = forward ? (at + 1) % items.length
    : back ? (at - 1 + items.length) % items.length
    : e.key === 'Home' ? 0
    : e.key === 'End' ? items.length - 1
    : -1
  if (to < 0) return
  e.preventDefault()
  items[to].focus()
  items[to].click()
}

/** Load one HTML fragment; returns null while loading. */
export function usePage(chapterId: string | undefined, file: string | undefined, enabled = true) {
  const [state, setState] = useState<{ key: string; html: string } | null>(null)
  const key = `${chapterId}/${file}`
  useEffect(() => {
    if (!chapterId || !file || !enabled) return
    let live = true
    loadPage(chapterId, file).then((html) => live && setState({ key, html }))
    return () => {
      live = false
    }
  }, [chapterId, file, enabled, key])
  return state && state.key === key ? state.html : null
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · LearningAI` : 'LearningAI · Enterprise AI Field Manual'
  }, [title])
}
