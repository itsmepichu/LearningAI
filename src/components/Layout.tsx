import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { Menu, Moon, Search, Sun, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { SearchDialog } from './SearchDialog'
import { Logo, ProgressRing } from './Icons'
import { useTheme } from '../store/theme'
import { useProgress } from '../store/progress'
import { courseTopics, getChapter, getTopic } from '../data/course'

export function Layout() {
  const [navOpen, setNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const loc = useLocation()
  const { resolved, toggle } = useTheme()
  const studied = useProgress((s) => s.studied)
  const done = courseTopics.filter((t) => studied[t.id]).length

  useEffect(() => setNavOpen(false), [loc.pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || (document.activeElement as HTMLElement)?.isContentEditable
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const [, chId, tId] = loc.pathname.split('/')
  const ch = getChapter(chId)
  const tp = getTopic(tId)

  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <button className="icon-btn nav-toggle" type="button" aria-label="Open contents" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>
          <Menu size={18} />
        </button>
        <Link to="/" className="brand" aria-label="LearningAI home">
          <Logo width={28} height={28} />
          <span className="brand-txt">
            <b>LearningAI</b>
            <small>Enterprise AI Field Manual</small>
          </span>
        </Link>
        <nav className="crumbs" aria-label="Breadcrumb">
          {ch && (
            <Link to={`/${ch.id}`}>
              <span className="mono">{ch.num}</span> {ch.title}
            </Link>
          )}
          {tp && (
            <span aria-current="page">
              <span className="mono">{tp.tn}</span> {tp.title}
            </span>
          )}
        </nav>
        <button className="search-btn" type="button" onClick={() => setSearchOpen(true)} aria-label="Search all topics">
          <Search size={15} />
          <span className="lbl">Search</span>
          <kbd>/</kbd>
        </button>
        <Link to="/progress" className="top-prog" title={`${done} of ${courseTopics.length} topics studied`} aria-label="Your progress">
          <ProgressRing value={done / courseTopics.length} size={30} stroke={3.5} />
        </Link>
        <button className="icon-btn" type="button" onClick={toggle} aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}>
          {resolved === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </header>
      <div className="shell">
        <aside className={'side' + (navOpen ? ' open' : '')} aria-label="Contents">
          <div className="side-head">
            <span>Contents</span>
            <button className="icon-btn" type="button" aria-label="Close contents" onClick={() => setNavOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <Sidebar />
        </aside>
        {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
        <main id="main" className="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
