import { useCallback, useMemo, useRef, useState } from 'react'
import { Slider, ThemeCanvas, Widget, fmt, type CanvasFrame } from '../kit'
import { DEFAULT_CORPUS, build, generate, loss, reset, train } from './bigram'

const START = 'Press Train, then Sample. Before training, samples are random characters.'

export default function BigramLm() {
  const [text, setText] = useState(DEFAULT_CORPUS)
  const [lr, setLr] = useState(50)
  const [temp, setTemp] = useState(80)
  const [out, setOut] = useState(START)
  const model = useMemo(() => build(text), [text])
  const hist = useRef<number[]>([])
  const [, setTick] = useState(0)
  // a different corpus starts a new curve
  const lastModel = useRef(model)
  if (lastModel.current !== model) {
    lastModel.current = model
    hist.current = [loss(model)]
  } else if (!hist.current.length) hist.current = [loss(model)]

  const doTrain = () => {
    hist.current.push(...train(model, 200, lr))
    setTick((t) => t + 1)
  }
  const doReset = () => {
    reset(model)
    hist.current = [loss(model)]
    setOut('Weights reset. Samples now are random characters. Press Train.')
    setTick((t) => t + 1)
  }
  const n = model.vocab.length
  const last = hist.current[hist.current.length - 1] ?? 0

  const draw = useCallback(
    ({ ctx, width, height, tokens }: CanvasFrame) => {
      const h = hist.current
      const mx = Math.log(Math.max(2, n)) * 1.05
      const Y = (v: number) => height - 20 - (v / mx) * (height - 30)
      const X = (i: number) => 40 + (i / Math.max(h.length - 1, 1)) * (width - 60)
      ctx.strokeStyle = tokens.rule
      ctx.beginPath()
      ctx.moveTo(40, height - 20)
      ctx.lineTo(width - 20, height - 20)
      ctx.stroke()
      ctx.setLineDash([5, 4])
      ctx.strokeStyle = tokens.muted
      ctx.beginPath()
      ctx.moveTo(40, Y(Math.log(n)))
      ctx.lineTo(width - 20, Y(Math.log(n)))
      ctx.stroke()
      ctx.strokeStyle = tokens.signal
      ctx.beginPath()
      ctx.moveTo(40, Y(model.floor))
      ctx.lineTo(width - 20, Y(model.floor))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = tokens.muted
      ctx.fillText(`ln V = ${fmt(Math.log(n), 2)} (guessing uniformly)`, 44, Y(Math.log(n)) - 4)
      ctx.fillStyle = tokens.signal
      ctx.fillText(`best possible bigram loss = ${fmt(model.floor, 2)}`, 44, Y(model.floor) - 4)
      ctx.strokeStyle = tokens.accent
      ctx.lineWidth = 2
      ctx.beginPath()
      h.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))))
      ctx.stroke()
      ctx.lineWidth = 1
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, n, last],
  )

  return (
    <Widget name="bigram-lm">
      <label htmlFor="bigram-text" style={{ display: 'block' }}>Training corpus</label>
      <textarea id="bigram-text" value={text} rows={4} style={{ width: '100%' }} onChange={(e) => { setText(e.target.value); setOut(START) }} />
      <div className="row2">
        <Slider label="Learning rate" value={lr} min={1} max={100} onChange={setLr} />
        <Slider label="Sampling temperature" value={temp} min={10} max={200} onChange={setTemp} format={(v) => fmt(v / 100, 2)} />
      </div>
      <div className="ctl">
        <button type="button" className="btn primary" onClick={doTrain}>Train 200 steps</button>
        <button type="button" className="btn" onClick={() => setOut(generate(model, temp / 100, Math.random))}>Sample text</button>
        <button type="button" className="btn" onClick={doReset}>Reset weights</button>
        <span className="count">vocab {n} chars · {n * n} parameters · {model.steps} steps · loss {fmt(last, 3)} nats</span>
      </div>
      <ThemeCanvas height={150} draw={draw} label={`Training loss ${fmt(last, 3)} nats, between ${fmt(model.floor, 2)} (best possible) and ${fmt(Math.log(n), 2)} (random guessing).`} />
      <div className="out" aria-live="polite" style={{ whiteSpace: 'pre-wrap' }}>{out}</div>
    </Widget>
  )
}
