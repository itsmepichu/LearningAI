import { Flag } from 'lucide-react'

const REPO = 'itsmepichu/LearningAI'

/** A plain link that opens a new, prefilled GitHub issue. The page makes no request and sends nothing itself. */
export function ReportProblem({ topicId, title }: { topicId: string; title: string }) {
  const q = new URLSearchParams({
    template: 'content-problem.yml',
    title: `[content] ${topicId} ${title}`,
    topic: topicId,
    page: `${location.origin}${location.pathname}`,
  })
  return (
    <p className="t-report">
      <Flag size={14} aria-hidden="true" />{' '}
      <a href={`https://github.com/${REPO}/issues/new?${q}`} target="_blank" rel="noopener noreferrer">
        Report a problem with this topic<span className="sr-only"> (opens GitHub in a new tab)</span>
      </a>
      <span className="muted"> · Opens a public GitHub issue with the topic filled in.</span>
    </p>
  )
}
