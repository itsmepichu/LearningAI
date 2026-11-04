/** Small inline icon set (stroke icons, 24px grid). Lucide is used for the rest. */
import type { SVGProps } from 'react'

export function ProgressRing({ value, size = 40, stroke = 4, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring" role="img" aria-label={label ?? `${Math.round(v * 100)}% complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="ring-fg"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <rect width="32" height="32" rx="9" className="logo-bg" />
      <path d="M8 22 L13 10 L18 22 M10 18 H16" className="logo-a" />
      <path d="M22 10 V22" className="logo-i" />
      <circle cx="22" cy="7" r="1.6" className="logo-dot" />
    </svg>
  )
}
