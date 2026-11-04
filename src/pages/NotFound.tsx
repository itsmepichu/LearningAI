import { Link } from 'react-router'
import { useDocumentTitle } from '../components/common'

export function NotFound() {
  useDocumentTitle('Not found')
  return (
    <div className="page-narrow nf">
      <span className="c-kicker">404</span>
      <h1 className="page-h">This page is not in the manual</h1>
      <p className="muted">The link may be from an older version. Search with <kbd>/</kbd> or go back to the course map.</p>
      <Link className="btn primary" to="/">
        Course map
      </Link>
    </div>
  )
}
