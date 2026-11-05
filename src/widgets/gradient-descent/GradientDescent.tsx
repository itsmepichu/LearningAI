import { useCallback, useEffect, useState } from 'react'
import { Slider, ThemeCanvas, Widget, fmt, useReducedMotion, type CanvasFrame } from '../kit'
import { descend, loss, run, slope } from './descent'

const RUN_STEPS = 25
const STEP_MS = 110
const DOMAIN = 6
const CLAMP = 6.3

export default function GradientDescent() {
  const [rate, setRate] = useState(0.2)
  const [start, setStart] = useState(-2.6)
  const [xs, setXs] = useState<number[]>([-2.6])
  const [left, setLeft] = useState(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => {
      setXs((v) => [...v, descend(v[v.length - 1], rate)])
      setLeft((n) => n - 1)
    }, STEP_MS)
    return () => clearTimeout(t)
  }, [left, xs, rate])

  const runMany = () => {
    if (reduced) setXs((v) => [...v, ...run(v[v.length - 1], rate, RUN_STEPS).slice(1)])
    else setLeft(RUN_STEPS)
  }
  const reset = (from = start) => {
    setLeft(0)
    setXs([from])
  }

  const draw = useCallback(
    ({ ctx, width, height, tokens }: CanvasFrame) => {
      const X = (v: number) => 30 + ((v + DOMAIN) / (2 * DOMAIN)) * (width - 50)
      const Y = (v: number) => height - 25 - ((v - 1.5) / 6.5) * (height - 40)
      ctx.strokeStyle = tokens.rule
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(30, height - 25)
      ctx.lineTo(width - 20, height - 25)
      ctx.stroke()
      ctx.fillStyle = tokens.muted
      ctx.textAlign = 'center'
      for (let t = -DOMAIN; t <= DOMAIN; t += 2) ctx.fillText(String(t), X(t), height - 8)
      ctx.strokeStyle = tokens.accent
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i <= 300; i++) {
        const v = -DOMAIN + (2 * DOMAIN * i) / 300
        if (i) ctx.lineTo(X(v), Y(loss(v)))
        else ctx.moveTo(X(v), Y(loss(v)))
      }
      ctx.stroke()
      const shown = xs.map((v) => Math.max(-CLAMP, Math.min(CLAMP, v)))
      ctx.strokeStyle = tokens.signal
      ctx.lineWidth = 1.5
      ctx.beginPath()
      shown.forEach((v, i) => (i ? ctx.lineTo(X(v), Y(loss(v))) : ctx.moveTo(X(v), Y(loss(v)))))
      ctx.stroke()
      shown.forEach((v, i) => {
        const last = i === shown.length - 1
        ctx.fillStyle = last ? tokens.bad : tokens.signal
        ctx.beginPath()
        ctx.arc(X(v), Y(loss(v)), last ? 6 : 3.5, 0, 7)
        ctx.fill()
      })
    },
    [xs],
  )

  const x = xs[xs.length - 1]
  const reading = `Step ${xs.length - 1}: x = ${fmt(x, 3)}, L(x) = ${fmt(loss(x), 3)}, slope = ${fmt(slope(x), 3)}`
  return (
    <Widget name="gradient-descent">
      <div className="row2">
        <Slider label="Learning rate η" value={rate} min={0.01} max={2} step={0.01} format={(v) => fmt(v, 2)} onChange={setRate} />
        <Slider
          label="Start x₀"
          value={start}
          min={-3}
          max={3}
          step={0.1}
          format={(v) => fmt(v, 1)}
          onChange={(v) => {
            setStart(v)
            reset(v)
          }}
        />
      </div>
      <ThemeCanvas height={260} draw={draw} label={`The loss curve L(x) = 0.1x² + sin(x) + 3, with the path of gradient descent on it. ${reading}.`} />
      <div className="ctl">
        <button type="button" className="btn primary" onClick={runMany}>
          Run {RUN_STEPS} steps
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setLeft(0)
            setXs((v) => [...v, descend(v[v.length - 1], rate)])
          }}
        >
          One step
        </button>
        <button type="button" className="btn" onClick={() => reset()}>
          Reset
        </button>
        <span className="count" aria-live="polite">
          {reading}
        </span>
      </div>
    </Widget>
  )
}
