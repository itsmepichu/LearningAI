import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { KpiRow, Slider, ThemeCanvas, Widget, fmt, type CanvasFrame } from '../kit'
import { ACTS, DATASETS, forward, initNet, makeData, paramCount, trainStep, type ActName, type DataName, type Net } from './net'

type Hist = [number, number][]

export default function NnPlayground() {
  const ids = [useId(), useId()]
  const [dataset, setDataset] = useState<DataName>('moons')
  const [hidden, setHidden] = useState(8)
  const [act, setAct] = useState<ActName>('tanh')
  const [lr, setLr] = useState(30)
  const [running, setRunning] = useState(false)
  const [, setTick] = useState(0)
  const data = useMemo(() => makeData(dataset), [dataset])
  const net = useRef<Net>(initNet(8, 'tanh'))
  const hist = useRef<Hist>([])
  const lrRef = useRef(lr)
  lrRef.current = lr

  const reset = useCallback(() => {
    net.current = initNet(hidden, act)
    hist.current = []
    for (let k = 0; k < 60; k++) hist.current.push(trainStep(net.current, data.points, data.labels, lrRef.current / 100))
    setTick((t) => t + 1)
  }, [hidden, act, data])
  // a new dataset, size or activation starts a fresh network
  useEffect(() => {
    setRunning(false)
    reset()
  }, [reset])

  useEffect(() => {
    if (!running) return
    let raf = 0
    const loop = () => {
      for (let k = 0; k < 4; k++) hist.current.push(trainStep(net.current, data.points, data.labels, lrRef.current / 100))
      if (hist.current.length > 400) hist.current = hist.current.filter((_, i) => i % 2 === 0)
      setTick((t) => t + 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, data])

  const last = hist.current[hist.current.length - 1]
  const drawMap = useCallback(
    ({ ctx, width, height, tokens }: CanvasFrame) => {
      const n = 40
      const cs = width / n
      const toS = (v: number) => (v + 1.1) / 2.2
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const p = forward(net.current, [-1.1 + ((i + 0.5) / n) * 2.2, 1.1 - ((j + 0.5) / n) * 2.2]).p
          ctx.fillStyle = p > 0.5 ? tokens.bad : tokens.accent
          ctx.globalAlpha = 0.18 + Math.abs(p - 0.5) * 0.7
          ctx.fillRect(i * cs, j * cs, cs + 0.5, cs + 0.5)
        }
      }
      ctx.globalAlpha = 1
      data.points.forEach((p, k) => {
        ctx.fillStyle = data.labels[k] ? tokens.bad : tokens.accent
        ctx.strokeStyle = tokens.surface
        ctx.beginPath()
        ctx.arc(toS(p[0]) * width, (1 - toS(p[1])) * height, 3.6, 0, 7)
        ctx.fill()
        ctx.stroke()
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, last],
  )
  const drawLoss = useCallback(
    ({ ctx, width, height, tokens }: CanvasFrame) => {
      const h = hist.current
      const mx = Math.max(0.75, ...h.map((x) => x[0]))
      ctx.strokeStyle = tokens.rule
      ctx.beginPath()
      ctx.moveTo(30, height - 20)
      ctx.lineTo(width - 10, height - 20)
      ctx.stroke()
      ctx.strokeStyle = tokens.accent
      ctx.lineWidth = 2
      ctx.beginPath()
      h.forEach((x, i) => {
        const px = 30 + (i / Math.max(1, h.length - 1)) * (width - 40)
        const py = height - 20 - (x[0] / mx) * (height - 40)
        if (i) ctx.lineTo(px, py)
        else ctx.moveTo(px, py)
      })
      ctx.stroke()
      ctx.lineWidth = 1
      ctx.fillStyle = tokens.muted
      ctx.fillText('training loss (cross-entropy)', 34, 14)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [last],
  )

  return (
    <Widget name="nn-playground">
      <div className="row2">
        <label htmlFor={ids[0]}>Dataset <select id={ids[0]} value={dataset} onChange={(e) => setDataset(e.target.value as DataName)}>{DATASETS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <Slider label="Hidden units per layer" value={hidden} min={2} max={16} onChange={setHidden} />
        <label htmlFor={ids[1]}>Activation <select id={ids[1]} value={act} onChange={(e) => setAct(e.target.value as ActName)}>{ACTS.map((a) => <option key={a}>{a}</option>)}</select></label>
        <Slider label="Learning rate" value={lr} min={1} max={100} onChange={setLr} format={(v) => fmt(v / 100, 2)} />
      </div>
      <div className="cols2">
        <ThemeCanvas height={320} draw={drawMap} label={`Predicted class probability for a ${DATASETS.find((d) => d.id === dataset)?.name} dataset after ${net.current.epoch} training steps.`} />
        <div>
          <ThemeCanvas height={160} draw={drawLoss} label={`Training loss curve, now ${last ? fmt(last[0], 3) : 'unknown'}.`} />
          <KpiRow
            items={[
              { label: 'epochs', value: fmt(net.current.epoch) },
              { label: 'loss', value: last ? fmt(last[0], 3) : '–' },
              { label: 'training accuracy', value: last ? `${fmt(last[1] * 100, 1)}%` : '–', tone: last && last[1] > 0.95 ? 'ok' : undefined },
            ]}
          />
        </div>
      </div>
      <div className="ctl">
        <button type="button" className="btn primary" onClick={() => setRunning((r) => !r)}>{running ? 'Pause' : 'Train'}</button>
        <button type="button" className="btn" onClick={() => { setRunning(false); reset() }}>Reset weights</button>
        <span className="count">{paramCount(hidden)} parameters</span>
      </div>
    </Widget>
  )
}
