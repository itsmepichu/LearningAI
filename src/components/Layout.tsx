import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { Menu, Moon, Search, Sun, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { SearchDialog } from './SearchDialog'
import { ProjectPicker } from './ProjectPicker'
import { Logo, ProgressRing } from './Icons'
import { useTheme } from '../store/theme'
import { useProgress } from '../store/progress'
import { courseTopics, getChapter, getTopic } from '../data/course'

// Matches the CSS breakpoint where the sidebar becomes an off-screen drawer.
const DRAWER_QUERY = '(max-width: 1024px)'

function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const m = matchMedia(query)
      m.addEventListener('change', onChange)
      return () => m.removeEventListener('change', onChange)
    },
    () => matchMedia(query).matches,
  )
}

export function Layout() {
  const [navOpen, setNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const closeSearch = useCallback(() => setSearchOpen(false), [])
  const isDrawer = useMedia(DRAWER_QUERY)
  const drawerOpen = isDrawer && navOpen
  const toggleRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const loc = useLocation()
  const { resolved, toggle } = useTheme()
  const studied = useProgress((s) => s.studied)
  const done = courseTopics.filter((t) => studied[t.id]).length

  useEffect(() => setNavOpen(false), [loc.pathname])

  // Move focus into the open drawer. On close, return it to the menu button, or to
  // the new page if the reader closed the drawer by following one of its links.
  useEffect(() => {
    if (!drawerOpen) return
    const openedOn = window.location.pathname
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      const target = window.location.pathname === openedOn ? toggleRef.current : mainRef.current
      target?.focus({ preventScroll: true })
    }
  }, [drawerOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The search dialog marks the Escape it handles, so one press closes one layer.
      if (e.key === 'Escape' && navOpen && !e.defaultPrevented) {
        setNavOpen(false)
        return
      }
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || (document.activeElement as HTMLElement)?.isContentEditable
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [navOpen])

  const [, chId, tId] = loc.pathname.split('/')
  const ch = getChapter(chId)
  const tp = getTopic(tId)

  return (
    <div className="app">
      <a className="skip" href="#main" inert={drawerOpen}>Skip to content</a>
      <header className="topbar" inert={drawerOpen}>
        <button ref={toggleRef} className="icon-btn nav-toggle" type="button" aria-label="Open contents" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>
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
        <ProjectPicker />
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
        <aside className={'side' + (navOpen ? ' open' : '')} aria-label="Contents" inert={isDrawer && !navOpen}>
          <div {...(drawerOpen ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Contents' } : {})}>
            <div className="side-head">
              <span>Contents</span>
              <button ref={closeRef} className="icon-btn" type="button" aria-label="Close contents" onClick={() => setNavOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <Sidebar />
          </div>
        </aside>
        {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
        <main ref={mainRef} id="main" className="main" tabIndex={-1} inert={drawerOpen}>
          <Outlet />
        </main>
      </div>
      <SearchDialog open={searchOpen} onClose={closeSearch} />
    </div>
  )
}
