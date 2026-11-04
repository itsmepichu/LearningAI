import { useCallback, useEffect, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { DataGate, DataSource, KpiRow, Legend, SERIES, Slider, ThemeCanvas, Widget, fmt, useNearViewport, useProjectData, useReducedMotion, type CanvasFrame } from '../kit'
import { loadStreamScenario, piecesAt, type StreamScenario } from './scenarios'

const s1 = (v: number) => `${fmt(v, 1)} s`

function Player({ scenario }: { scenario: StreamScenario }) {
  const reduced = useReducedMotion()
  const [ttft, setTtft] = useState(0.7)
  const [generation, setGeneration] = useState(3.5)
  const total = ttft + generation
  const [t, setT] = useState(reduced ? total : 0)
  const [playing, setPlaying] = useState(false)
  const [ref, near] = useNearViewport<HTMLDivElement>()
  const pieces = scenario.answer.split(/(?=\s)/)
  const shown = piecesAt(t, ttft, generation, pieces.length)
  const done = t >= total
  const time = Math.min(t, total)

  useEffect(() => {
    if (near && !reduced) setPlaying(true)
  }, [near, reduced])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setT((v) => Math.min(v + dt, total))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, total])
  useEffect(() => {
    if (t >= total) setPlaying(false)
  }, [t, total])

  const toggle = () => {
    if (playing) return setPlaying(false)
    if (reduced) return setT(total)
    if (done) setT(0)
    setPlaying(true)
  }
  const scrub = (v: number) => {
    setPlaying(false)
    setT(v)
  }
  // Timing changes keep the reader's place in a finished run, so the end state stays visible.
  const retime = (set: (v: number) => void) => (v: number) => {
    set(v)
    if (done) setT(Infinity)
  }

  const draw = useCallback(
    ({ ctx, width, height, tokens }: CanvasFrame) => {
      const L = 44
      const R = 12
      const T = 8
      const B = 40
      const iw = width - L - R
      const ih = height - T - B
      const X = (v: number) => L + (v / total) * iw
      const Y = (share: number) => T + (1 - share) * ih
      ctx.strokeStyle = tokens.rule
      ctx.fillStyle = tokens.muted
      ctx.lineWidth = 1
      ctx.font = `12px ${tokens.fontMono}`
      for (const share of [0, 0.5, 1]) {
        ctx.beginPath()
        ctx.moveTo(L, Y(share))
        ctx.lineTo(L + iw, Y(share))
        ctx.stroke()
        ctx.textAlign = 'right'
        ctx.fillText(`${share * 100}%`, L - 6, Y(share) + 4)
      }
      ctx.textAlign = 'center'
      const gap = total > 6 ? 2 : 1
      for (let s = 0; s <= total; s += gap) ctx.fillText(String(s), X(s), T + ih + 16)
      ctx.fillText('seconds since the request', L + iw / 2, height - 4)
      const line = (color: string, pts: [number, number][]) => {
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.beginPath()
        pts.forEach(([a, b], i) => (i ? ctx.lineTo(X(a), Y(b)) : ctx.moveTo(X(a), Y(b))))
        ctx.stroke()
      }
      line(tokens.signal, [
        [0, 0],
        [total, 0],
        [total, 1],
      ])
      line(tokens.accent, [
        [0, 0],
        [ttft, 0],
        [total, 1],
      ])
      ctx.strokeStyle = tokens.ink
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(X(time), T)
      ctx.lineTo(X(time), T + ih)
      ctx.stroke()
    },
    [time, total, ttft],
  )

  return (
    <div ref={ref} className="wid">
      <p className="wk-q">
        <b>Question:</b> {scenario.question}
      </p>
      <div className="row2">
        <Slider label="Time to first token" value={ttft} min={0.2} max={3} step={0.1} format={s1} onChange={retime(setTtft)} />
        <Slider label="Generation time" value={generation} min={1} max={8} step={0.5} format={s1} onChange={retime(setGeneration)} />
      </div>
      <div className="cols2">
        <div>
          <span className="wk-stream-h">Non-streaming</span>
          <div className="out wk-stream">{done ? scenario.answer : <span className="wk-wait pulse">waiting for the full response…</span>}</div>
        </div>
        <div>
          <span className="wk-stream-h">Streaming</span>
          <div className="out wk-stream">
            {shown ? pieces.slice(0, shown).join('') : <span className="wk-wait pulse">prefill…</span>}
            {shown > 0 && shown < pieces.length && <span className="pulse">▌</span>}
          </div>
        </div>
      </div>
      <div className="ctl">
        <button type="button" className="btn primary" onClick={toggle}>
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {playing ? 'Pause' : done ? 'Replay' : 'Play'}
        </button>
        <span className="count">{reduced ? 'Animation is off (reduced motion). Drag the time slider.' : `t = ${s1(time)}`}</span>
      </div>
      <Slider label="Time" value={time} min={0} max={total} step={0.1} format={s1} onChange={scrub} />
      <KpiRow
        items={[
          { label: 'first words, streaming', value: s1(ttft), tone: 'ok' },
          { label: 'first words, non-streaming', value: s1(total), tone: 'warn' },
          { label: 'complete answer, both', value: s1(total) },
        ]}
      />
      <div>
        <Legend
          items={[
            { name: 'Streaming', color: SERIES[0] },
            { name: 'Non-streaming', color: SERIES[1] },
          ]}
        />
        <ThemeCanvas
          height={190}
          draw={draw}
          label={`Share of the answer on screen over time. Streaming starts at ${s1(ttft)} and rises steadily to 100% at ${s1(total)}. Non-streaming stays at zero, then jumps to 100% at ${s1(total)}.`}
        />
      </div>
    </div>
  )
}

export default function Streaming() {
  const state = useProjectData(loadStreamScenario)
  return (
    <Widget name="streaming">
      <DataGate state={state}>
        {(scenario, project) => (
          <>
            <DataSource project={project} files={[scenario.file]}>
              {scenario.illustrativeAnswer ? 'The answer text is illustrative. ' : ''}Timing is illustrative: no model runs here.
            </DataSource>
            <Player key={project.id} scenario={scenario} />
          </>
        )}
      </DataGate>
    </Widget>
  )
}
