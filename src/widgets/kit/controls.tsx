import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { useReducedMotion } from './hooks'
import './kit.css'

/** Outer element of a widget: the legacy `.wid` layout plus the kit's type floor and motion rules. */
export function Widget({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="wid wk" data-kit-widget={name}>
      {children}
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = String,
}: {
  label: ReactNode
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const id = useId()
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <label htmlFor={id} className="wk-slider">
      <span className="wk-slider-l">{label}</span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(+e.target.value)}
        style={{ '--p': `${fill}%` } as CSSProperties}
      />
      <output htmlFor={id} className="wk-val">
        {format(value)}
      </output>
    </label>
  )
}

/**
 * A table or log that may overflow. It takes a tab stop and a name only while it does, so keyboard users can
 * scroll it without passing through regions that fit. The -1 also tells the legacy pass to leave it alone.
 */
export function ScrollRegion({ label, className = 'tw', children }: { label: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={className} tabIndex={overflows ? 0 : -1} role={overflows ? 'region' : undefined} aria-label={overflows ? label : undefined}>
      {children}
    </div>
  )
}

export type Tone = 'ok' | 'warn' | 'bad'
export interface Kpi {
  label: ReactNode
  value: ReactNode
  tone?: Tone
}

export function KpiRow({ items }: { items: Kpi[] }) {
  return (
    <div className="kpis">
      {items.map((k, i) => (
        <div key={i} className={'kpi' + (k.tone ? ' ' + k.tone : '')}>
          <b>{k.value}</b>
          <span>{k.label}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Prev, next, play and reset over `count` steps. The parent owns `step` (0-based), so a step can be derived
 * from anything. With reduced motion, Play jumps to the last step rather than animating through them.
 */
export function StepPlayer({
  count,
  step,
  onStep,
  intervalMs = 1400,
  noun = 'Step',
}: {
  count: number
  step: number
  onStep: (next: number) => void
  intervalMs?: number
  noun?: string
}) {
  const [playing, setPlaying] = useState(false)
  const reduced = useReducedMotion()
  const last = Math.max(0, count - 1)

  useEffect(() => {
    if (!playing) return
    if (step >= last) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => onStep(step + 1), intervalMs)
    return () => clearTimeout(t)
  }, [playing, step, last, intervalMs, onStep])

  const play = () => {
    if (playing) return setPlaying(false)
    if (reduced) return onStep(last)
    if (step >= last) onStep(0)
    setPlaying(true)
  }
  const move = (to: number) => {
    setPlaying(false)
    onStep(Math.max(0, Math.min(last, to)))
  }
  return (
    <div className="wk-player">
      <div className="ctl">
        <button type="button" className="btn" onClick={() => move(step - 1)} disabled={step <= 0}>
          <ChevronLeft aria-hidden="true" />
          Prev
        </button>
        <button type="button" className="btn primary" onClick={() => move(step + 1)} disabled={step >= last}>
          Next
          <ChevronRight aria-hidden="true" />
        </button>
        <button type="button" className="btn" onClick={play}>
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="btn" onClick={() => move(0)} disabled={step <= 0}>
          <RotateCcw aria-hidden="true" />
          Reset
        </button>
        <span className="count" aria-live="polite">
          {noun} {Math.min(step + 1, count)} of {count}
        </span>
      </div>
      <div className="wk-meter" aria-hidden="true">
        <i style={{ width: `${count ? ((step + 1) / count) * 100 : 0}%` }} />
      </div>
    </div>
  )
}

export interface StepEvent {
  tone: Tone | 'info'
  /** The tone in words, so that state is never shown by colour alone. */
  status: string
  title: string
  detail?: string
  /** An identifier the event uses, such as an idempotency key. */
  code?: string
}

/** A sequence of events, for a run stepped through with `StepPlayer`. */
export function EventList({ events }: { events: StepEvent[] }) {
  return (
    <div className="wk-events">
      {events.map((e, i) => (
        <div key={i} className={'wk-ev ' + e.tone}>
          <span className="wk-ev-s">{e.status}.</span> <b>{e.title}.</b>
          {e.detail && <> {e.detail}.</>}
          {e.code && (
            <>
              {' '}
              Key <code>{e.code}</code>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
