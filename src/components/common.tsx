import { useEffect, useState } from 'react'
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
