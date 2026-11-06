import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { BookA, Search } from 'lucide-react'
import { getTopic, topicPath } from '../data/course'
import { loadGlossary, sortedEntries, type Glossary } from '../data/glossary'
import { useDocumentTitle } from '../components/common'

/** Every glossary term, A to Z, with a filter. Term links in the content land on `#gl-<id>` here. */
export function GlossaryPage() {
  useDocumentTitle('Glossary')
  const [glossary, setGlossary] = useState<Glossary | null>(null)
  const [filter, setFilter] = useState('')
  const loc = useLocation()

  useEffect(() => {
    loadGlossary().then(setGlossary)
  }, [])

  const entries = useMemo(() => (glossary ? sortedEntries(glossary) : []), [glossary])
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase()
    if (!f) return entries
    return entries.filter(([, e]) => [e.term, e.def, ...(e.aliases ?? [])].some((t) => t.toLowerCase().includes(f)))
  }, [entries, filter])
  const groups = useMemo(() => {
    const m = new Map<string, typeof shown>()
    for (const en of shown) {
      const k = en[1].term.replace(/^[^A-Za-z0-9]+/, '')[0]?.toUpperCase() ?? '#'
      const letter = /[A-Z]/.test(k) ? k : '#'
      m.set(letter, [...(m.get(letter) ?? []), en])
    }
    return [...m.entries()]
  }, [shown])

  // Bring the linked term into view and mark it, once the entries exist.
  useEffect(() => {
    if (!glossary || !loc.hash) return
    const el = document.getElementById(decodeURIComponent(loc.hash.slice(1)))
    if (!el) return
    setFilter('')
    requestAnimationFrame(() => el.scrollIntoView({ block: 'center' }))
    el.classList.add('hit')
    const t = window.setTimeout(() => el.classList.remove('hit'), 2400)
    return () => window.clearTimeout(t)
  }, [glossary, loc.hash])

  return (
    <div className="glossary-page page-narrow">
      <span className="c-kicker">Whole course</span>
      <h1 className="page-h">
        <BookA size={28} /> Glossary
      </h1>
      <p className="muted lead">
        Short definitions of the terms the course uses, each linked to the topic that teaches it. In the text, a term with a dotted underline shows its
        definition when you hover over it or move to it with the keyboard.
      </p>
      <label className="gl-filter">
        <Search size={15} aria-hidden="true" />
        <span className="sr-only">Filter terms</span>
        <input type="search" placeholder="Filter terms" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </label>
      {glossary && (
        <p className="muted gl-count" role="status">
          {shown.length === entries.length ? `${entries.length} terms` : `${shown.length} of ${entries.length} terms`}
        </p>
      )}
      {groups.map(([letter, list]) => (
        <section key={letter} className="gl-group" aria-labelledby={`gl-letter-${letter}`}>
          <h2 id={`gl-letter-${letter}`}>{letter}</h2>
          <dl>
            {list.map(([id, e]) => {
              const topic = getTopic(e.topic)
              return (
                <div key={id} id={`gl-${id}`} className="gl-entry">
                  <dt>
                    {e.term}
                    {e.aliases?.length ? <span className="muted"> · also {e.aliases.join(', ')}</span> : null}
                  </dt>
                  <dd>
                    {e.def}
                    {topic && (
                      <Link to={topicPath(topic)}>
                        {topic.tn} {topic.title}
                      </Link>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      ))}
    </div>
  )
}
