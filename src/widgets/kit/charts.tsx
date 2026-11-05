import { useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { useWidth } from './hooks'

/**
 * Chart primitives. Colours are CSS variables, so they follow the theme without a redraw.
 * Categorical order is fixed: accent, signal, sim. These three pass the CVD and contrast checks on both surfaces.
 */
export const SERIES = ['var(--accent)', 'var(--signal)', 'var(--sim)'] as const

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <ul className="wk-legend">
      {items.map((s) => (
        <li key={s.name}>
          <i style={{ background: s.color }} aria-hidden="true" />
          {s.name}
        </li>
      ))}
    </ul>
  )
}

export interface BarItem {
  label: ReactNode
  value: number
  /** Replaces the formatted value inside the bar. */
  text?: string
  color?: string
}

/** Horizontal bars with the value in the bar. Uses the content design system's `.bars` styles. */
export function BarList({ items, max }: { items: BarItem[]; max?: number }) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1e-9)
  return (
    <div className="bars">
      {items.map((b, i) => (
        <div className="row" key={i}>
          <div className="lbl">{b.label}</div>
          <div className="track">
            <div className="fill" style={{ width: `${Math.max(0.5, Math.min(100, (b.value / top) * 100))}%`, ...(b.color ? ({ '--c': b.color } as CSSProperties) : null) }} />
            <span className="val">{b.text ?? String(b.value)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export interface StackSegment {
  name: string
  size: number
  color?: string
  /** Hatched instead of solid, for space that is set aside rather than used. */
  hatched?: boolean
}

/** One bar split into named segments, as shares of `total`. `label` is the text alternative. */
export function StackBar({ segments, total, label }: { segments: StackSegment[]; total: number; label: string }) {
  return (
    <div className="wk-stack" role="img" aria-label={label}>
      {segments.map(
        (s, i) =>
          s.size > 0 && (
            <div
              key={i}
              className={s.hatched ? 'hatched' : undefined}
              title={`${s.name}: ${s.size.toLocaleString('en-US')}`}
              style={{ width: `${(s.size / total) * 100}%`, background: s.hatched ? undefined : s.color }}
            />
          ),
      )}
    </div>
  )
}

export interface LineSeries {
  name: string
  color: string
  values: number[]
}

const M = { left: 40, top: 10, bottom: 40 }
const LABEL_GAP = 15

/** Spreads end-of-line labels apart so they do not overlap, keeping them close to their lines. */
function spreadLabels(ys: number[]): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  for (let k = 1; k < order.length; k++) if (order[k].y - order[k - 1].y < LABEL_GAP) order[k].y = order[k - 1].y + LABEL_GAP
  const out = [...ys]
  order.forEach((o) => (out[o.i] = o.y))
  return out
}

/**
 * Lines over shared integer x positions on one 0 to 1 axis, with a legend, direct end labels when there is room,
 * an optional marker at one x, and a crosshair tooltip. Numbers it plots must also appear as text nearby.
 */
export function LineChart({
  x,
  series,
  xLabel,
  marker,
  format,
  height = 220,
  label,
}: {
  x: number[]
  series: LineSeries[]
  xLabel: string
  marker?: number
  format: (v: number) => string
  height?: number
  label: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const direct = width >= 440
  const right = direct ? 110 : 16
  const iw = Math.max(0, width - M.left - right)
  const ih = height - M.top - M.bottom
  const xs = (i: number) => M.left + (x.length > 1 ? (i / (x.length - 1)) * iw : iw / 2)
  const ys = (v: number) => M.top + (1 - v) * ih
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const f = x.length > 1 ? (e.clientX - box.left) / box.width : 0
    setHover(Math.max(0, Math.min(x.length - 1, Math.round(f * (x.length - 1)))))
  }
  const ends = spreadLabels(series.map((s) => ys(s.values[s.values.length - 1] ?? 0) + 4))
  const tipLeft = hover === null ? 0 : Math.min(xs(hover) + 10, Math.max(0, width - 170))
  return (
    <div>
      <Legend items={series} />
      <div ref={ref} className="wk-chart" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={label}>
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line className="wk-gl" x1={M.left} x2={M.left + iw} y1={ys(t)} y2={ys(t)} />
                <text className="wk-tick" x={M.left - 8} y={ys(t) + 4} textAnchor="end">
                  {format(t)}
                </text>
              </g>
            ))}
            {x.map((v, i) => (
              <text key={v} className="wk-tick" x={xs(i)} y={M.top + ih + 18} textAnchor="middle">
                {v}
              </text>
            ))}
            <text className="wk-tick" x={M.left + iw / 2} y={height - 4} textAnchor="middle">
              {xLabel}
            </text>
            {marker !== undefined && x.indexOf(marker) >= 0 && <line className="wk-mark" x1={xs(x.indexOf(marker))} x2={xs(x.indexOf(marker))} y1={M.top} y2={M.top + ih} />}
            {hover !== null && <line className="wk-cross" x1={xs(hover)} x2={xs(hover)} y1={M.top} y2={M.top + ih} />}
            {series.map((s) => (
              <polyline key={s.name} className="wk-line" style={{ stroke: s.color }} points={s.values.map((v, i) => `${xs(i)},${ys(v)}`).join(' ')} />
            ))}
            {marker !== undefined &&
              x.indexOf(marker) >= 0 &&
              series.map((s) => <circle key={s.name} className="wk-dot" style={{ fill: s.color }} cx={xs(x.indexOf(marker))} cy={ys(s.values[x.indexOf(marker)] ?? 0)} r={4} />)}
            {direct &&
              series.map((s, i) => (
                <text key={s.name} className="wk-end" x={M.left + iw + 8} y={ends[i]}>
                  {s.name}
                </text>
              ))}
            <rect x={M.left} y={M.top} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
          </svg>
        )}
        {hover !== null && (
          <div className="wk-tip" style={{ left: tipLeft, top: M.top }}>
            <b>
              {xLabel} {x[hover]}
            </b>
            {series.map((s) => (
              <span key={s.name}>
                <i style={{ background: s.color }} aria-hidden="true" />
                {s.name} <em>{format(s.values[hover] ?? 0)}</em>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
