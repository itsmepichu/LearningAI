import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Search } from 'lucide-react'
import type MiniSearch from 'minisearch'
import { getChapter, getTopic } from '../data/course'
import { fill, getProject, loadPractice, practiceChapterIds, projects } from '../data/projects'

interface Doc { id: string; ch: string; tn: string; title: string; text: string; topic: string; project?: string }
interface Index { ms: MiniSearch<Doc>; byId: Map<string, Doc> }

let indexPromise: Promise<Index> | null = null
function loadIndex(): Promise<Index> {
  indexPromise ??= Promise.all([
    import('minisearch'),
    import('../content/search.json'),
    Promise.all(practiceChapterIds().map((c) => loadPractice(c).then((d) => [c, d] as const))),
  ]).then(([m, data, practice]) => {
    const docs = ((data.default ?? data) as Doc[]).map((d) => ({ ...d, topic: d.id }))
    const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim()
    for (const [ch, byTopic] of practice) {
      for (const [topic, notes] of Object.entries(byTopic)) {
        const t = getTopic(topic)
        if (!t || topic === '_lab') continue
        for (const p of projects) {
          const n = (notes as Record<string, { practice: string; failure: string; tryIt?: string }>)[p.id]
          if (!n) continue
          docs.push({ id: `${topic}~${p.id}`, ch, topic, tn: t.tn, title: t.title, project: p.id, text: strip(fill([n.practice, n.failure, n.tryIt ?? ''].join(' '), p)) })
        }
      }
    }
    const ms = new m.default<Doc>({
      fields: ['tn', 'title', 'text'],
      storeFields: ['id'],
      searchOptions: { boost: { tn: 6, title: 4 }, prefix: true, fuzzy: 0.15, combineWith: 'AND' },
    })
    ms.addAll(docs)
    return { ms, byId: new Map(docs.map((d) => [d.id, d])) }
  })
  return indexPromise
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function snippet(text: string, terms: string[]) {
  const low = text.toLowerCase()
  let p = -1
  for (const t of terms) {
    p = low.indexOf(t)
    if (p >= 0) break
  }
  const start = Math.max(0, p - 50)
  const s = (start > 0 ? '… ' : '') + text.slice(start, start + 170) + ' …'
  const re = new RegExp('(' + terms.map(escapeRe).join('|') + ')', 'ig')
  return escapeHtml(s).replace(re, '<mark>$1</mark>')
}

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState<Index | null>(null)
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    loadIndex().then(setIdx)
    const t = setTimeout(() => input.current?.select(), 30)
    return () => clearTimeout(t)
  }, [open])

  const results = useMemo(() => {
    if (!idx || q.trim().length < 2) return []
    const terms = q.toLowerCase().split(/\s+/).filter((t) => t.length > 1)
    return idx.ms
      .search(q)
      .slice(0, 16)
      .map((r) => {
        const d = idx.byId.get(r.id as string)!
        return { d, html: snippet(d.text, terms), titleHtml: escapeHtml(d.title).replace(new RegExp('(' + terms.map(escapeRe).join('|') + ')', 'ig'), '<mark>$1</mark>') }
      })
  }, [idx, q])

  useEffect(() => setSel(0), [q])
  useEffect(() => {
    listRef.current?.querySelector('.sel')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const go = (d: Doc) => {
    onClose()
    navigate(`/${d.ch}/${d.topic}${d.project ? `?project=${d.project}` : ''}`)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!results.length) return
      setSel((s) => (s + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length)
    } else if (e.key === 'Enter' && results[sel]) {
      e.preventDefault()
      go(results[sel].d)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="srch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            className="srch-pnl"
            role="dialog"
            aria-modal="true"
            aria-label="Search the course"
            initial={{ y: -12, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onKeyDown={onKey}
          >
            <div className="srch-in">
              <Search size={18} aria-hidden="true" />
              <input
                ref={input}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search 143 topics — e.g. KV cache, LoRA, idempotency"
                aria-label="Search"
                aria-controls="srch-res"
                autoComplete="off"
              />
              <kbd>Esc</kbd>
            </div>
            <div className="srch-res" id="srch-res" ref={listRef} role="listbox">
              {!idx && <div className="srch-hint">Loading the search index…</div>}
              {idx && q.trim().length < 2 && <div className="srch-hint">Type at least two letters. Search covers every explanation, example, lab and failure note.</div>}
              {idx && q.trim().length >= 2 && !results.length && <div className="srch-hint">No match. Try a shorter term such as “cache”, “LoRA” or “permission”.</div>}
              {results.map((r, i) => (
                <button
                  key={r.d.id}
                  type="button"
                  role="option"
                  aria-selected={i === sel}
                  className={'srch-hit' + (i === sel ? ' sel' : '')}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(r.d)}
                >
                  <span className="srch-tn">{r.d.tn}</span>
                  <span className="srch-body">
                    <b dangerouslySetInnerHTML={{ __html: r.titleHtml }} />
                    <small>
                      {r.d.project && <span className="srch-proj">In practice · {getProject(r.d.project)?.label}</span>}
                      {getChapter(r.d.ch)?.title}
                    </small>
                    <span className="srch-snip" dangerouslySetInnerHTML={{ __html: r.html }} />
                  </span>
                </button>
              ))}
            </div>
            <div className="srch-foot">
              <span><kbd>↑</kbd> <kbd>↓</kbd> move</span>
              <span><kbd>Enter</kbd> open</span>
              <span><kbd>/</kbd> or <kbd>Ctrl K</kbd> anywhere</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
