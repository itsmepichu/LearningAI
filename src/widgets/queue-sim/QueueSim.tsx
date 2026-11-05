import { useCallback, useMemo, useState } from 'react'
import { KpiRow, Slider, ThemeCanvas, Widget, fmt, pct, type CanvasFrame } from '../kit'
import { SIM_SECONDS, simulateQueue } from './simulate'

export default function QueueSim() {
  const [rate, setRate] = useState(7)
  const [servers, setServers] = useState(4)
  const [service, setService] = useState(0.5)
  const [seed, setSeed] = useState(17)
  const run = useMemo(() => simulateQueue(rate, servers, service, seed), [rate, servers, service, seed])
  const peak = Math.max(10, ...run.queue)

  const draw = useCallback(
    ({ ctx, width, height, tokens }: CanvasFrame) => {
      const L = 40
      const B = 22
      const X = (s: number) => L + (s / SIM_SECONDS) * (width - L - 16)
      const Y = (v: number) => height - B - (v / peak) * (height - B - 22)
      ctx.strokeStyle = tokens.rule
      ctx.beginPath()
      ctx.moveTo(L, height - B)
      ctx.lineTo(width - 16, height - B)
      ctx.stroke()
      ctx.fillStyle = tokens.accentSoft
      ctx.beginPath()
      ctx.moveTo(X(0), Y(0))
      run.queue.forEach((v, s) => ctx.lineTo(X(s), Y(v)))
      ctx.lineTo(X(SIM_SECONDS - 1), Y(0))
      ctx.fill()
      ctx.strokeStyle = tokens.accent
      ctx.lineWidth = 1.5
      ctx.beginPath()
      run.queue.forEach((v, s) => (s ? ctx.lineTo(X(s), Y(v)) : ctx.moveTo(X(s), Y(v))))
      ctx.stroke()
      ctx.fillStyle = tokens.muted
      ctx.fillText(`Requests waiting in the queue (peak ${fmt(peak)})`, L, 14)
      ctx.textAlign = 'center'
      for (const s of [0, 60, 120, 180, 240, 300]) ctx.fillText(`${s}s`, X(s), height - 6)
    },
    [run, peak],
  )

  const unstable = run.utilisation >= 1
  return (
    <Widget name="queue-sim">
      <div className="row2">
        <Slider label="Arrival rate λ (requests/s)" value={rate} min={0.5} max={20} step={0.5} format={(v) => `${fmt(v, 1)}/s`} onChange={setRate} />
        <Slider label="Servers (concurrent slots) c" value={servers} min={1} max={16} onChange={setServers} />
        <Slider label="Mean service time" value={service} min={0.1} max={3} step={0.1} format={(v) => `${fmt(v, 1)} s`} onChange={setService} />
      </div>
      <ThemeCanvas height={200} draw={draw} label={`Queue length over ${SIM_SECONDS} simulated seconds, peaking at ${fmt(peak)} waiting requests. Utilisation is ${pct(run.utilisation)}.`} />
      <div className="ctl">
        <button type="button" className="btn primary" onClick={() => setSeed((s) => s + 1)}>
          Run 5 simulated minutes again
        </button>
      </div>
      <KpiRow
        items={[
          { label: 'utilisation ρ', value: pct(run.utilisation), tone: unstable ? 'bad' : run.utilisation > 0.85 ? 'warn' : 'ok' },
          { label: 'mean wait', value: `${fmt(run.meanWait, 2)} s` },
          { label: 'p95 wait', value: `${fmt(run.p95Wait, 2)} s`, tone: run.p95Wait > 5 ? 'bad' : undefined },
          { label: 'average in system (measured)', value: fmt(run.inSystem, 1) },
          { label: 'Little’s law: λ × (mean wait + mean service)', value: fmt(run.littles, 1) },
          { label: 'state', value: unstable ? 'unstable: the queue grows' : 'stable' },
        ]}
      />
    </Widget>
  )
}
