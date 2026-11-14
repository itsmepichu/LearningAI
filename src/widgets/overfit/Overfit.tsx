import { useCallback, useMemo, useState } from 'react'
import { KpiRow, Slider, ThemeCanvas, Widget, fmt, type CanvasFrame } from '../kit'
import { fitPoly, makeSets, mse, predict, truth } from './fit'

const SETS = makeSets()

export default function Overfit() {
  const [degree, setDegree] = useState(3)
  const [logLam, setLogLam] = useState(-8)
  const lambda = 10 ** logLam
  const w = useMemo(() => fitPoly(SETS.train, degree, lambda), [degree, lambda])
  const trainErr = mse(w, SETS.train)
  const validErr = mse(w, SETS.valid)

  const draw = useCallback(
    ({ ctx, width, height, tokens }: CanvasFrame) => {
      const X = (v: number) => 20 + v * (width - 40)
      const Y = (v: number) => height / 2 - (v * (height / 2 - 20)) / 1.6
      ctx.strokeStyle = tokens.rule
      ctx.beginPath()
      ctx.moveTo(20, Y(0))
      ctx.lineTo(width - 20, Y(0))
      ctx.stroke()
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = tokens.muted
      ctx.beginPath()
      for (let i = 0; i <= 200; i++) {
        const v = i / 200
        if (i) ctx.lineTo(X(v), Y(truth(v)))
        else ctx.moveTo(X(v), Y(truth(v)))
      }
      ctx.stroke()
      ctx.setLineDash([])
      ctx.strokeStyle = tokens.accent
      ctx.lineWidth = 2.2
      ctx.beginPath()
      for (let i = 0; i <= 400; i++) {
        const v = i / 400
        const y = Math.max(-3, Math.min(3, predict(w, v)))
        if (i) ctx.lineTo(X(v), Y(y))
        else ctx.moveTo(X(v), Y(y))
      }
      ctx.stroke()
      ctx.lineWidth = 1
      ctx.strokeStyle = tokens.signal
      for (const [a, b] of SETS.valid) {
        ctx.beginPath()
        ctx.arc(X(a), Y(b), 3.5, 0, 7)
        ctx.stroke()
      }
      ctx.fillStyle = tokens.ink
      for (const [a, b] of SETS.train) {
        ctx.beginPath()
        ctx.arc(X(a), Y(b), 4, 0, 7)
        ctx.fill()
      }
      ctx.fillStyle = tokens.muted
      ctx.fillText('dashed = true function · line = fitted model · filled = training · hollow = validation', 24, 16)
    },
    [w],
  )

  return (
    <Widget name="overfit">
      <div className="row2">
        <Slider label="Polynomial degree" value={degree} min={1} max={15} onChange={setDegree} />
        <Slider label="Regularisation λ (log)" value={logLam} min={-8} max={2} step={0.5} onChange={setLogLam} format={() => `λ = ${lambda < 1e-6 ? lambda.toExponential(0) : fmt(lambda, lambda < 1 ? 4 : 1)}`} />
      </div>
      <ThemeCanvas height={260} draw={draw} label={`A degree ${degree} polynomial fitted to 14 noisy points. Training error ${fmt(trainErr, 3)}, validation error ${fmt(validErr, 3)}.`} />
      <KpiRow
        items={[
          { label: 'training error (MSE)', value: fmt(trainErr, 3), tone: trainErr < 0.02 ? 'warn' : undefined },
          { label: 'validation error (MSE)', value: fmt(validErr, 3), tone: validErr > 0.15 ? 'bad' : validErr < 0.07 ? 'ok' : undefined },
          { label: 'gap (val − train)', value: fmt(validErr - trainErr, 3) },
          { label: 'parameters', value: degree + 1 },
        ]}
      />
    </Widget>
  )
}
