import { useEffect, useRef } from 'react'
import { useTheme } from '../../store/theme'
import { useWidth } from './hooks'

export interface Tokens {
  ink: string
  muted: string
  rule: string
  surface: string
  sunk: string
  accent: string
  accentSoft: string
  signal: string
  sim: string
  ok: string
  bad: string
  fontBody: string
  fontMono: string
}

/** Colours and fonts from the CSS tokens, resolved for the current theme. */
export function readTokens(): Tokens {
  const s = getComputedStyle(document.documentElement)
  const v = (n: string) => s.getPropertyValue(n).trim()
  return {
    ink: v('--ink'),
    muted: v('--muted'),
    rule: v('--rule-2'),
    surface: v('--surface'),
    sunk: v('--sunk'),
    accent: v('--accent'),
    accentSoft: v('--accent-soft'),
    signal: v('--signal'),
    sim: v('--sim'),
    ok: v('--ok'),
    bad: v('--bad'),
    fontBody: v('--f-body'),
    fontMono: v('--f-mono'),
  }
}

export interface CanvasFrame {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  tokens: Tokens
}

/**
 * A canvas sized to its column at device resolution. It calls `draw` in CSS pixels, again whenever `draw`,
 * the width or the theme changes, so a parent animates by passing a new `draw` for each frame.
 * Text on it stays at 12 px or more: the default font is set here. `label` is the text alternative.
 */
export function ThemeCanvas({ height, draw, label }: { height: number; draw: (frame: CanvasFrame) => void; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [wrap, width] = useWidth<HTMLDivElement>()
  const version = useTheme((s) => s.version)
  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || !width) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(width * dpr)
    c.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const tokens = readTokens()
    ctx.font = `12px ${tokens.fontBody}`
    ctx.textBaseline = 'alphabetic'
    draw({ ctx, width, height, tokens })
  }, [draw, width, height, version])
  return (
    <div ref={wrap} className="wk-canvas" style={{ height }}>
      <canvas ref={canvas} role="img" aria-label={label} style={{ width: '100%', height }} />
    </div>
  )
}
