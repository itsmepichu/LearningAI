import { useCallback, useId, useMemo, useState } from 'react'
import { KpiRow, Legend, ThemeCanvas, Widget, fmt, pct, type CanvasFrame } from '../kit'
import { FAST_BURN, HOURS, SCENARIOS, SLOW_BURN, TICKET_BURN, alertMarkers, firstAlertDay, simulateBurn, type AlertKind, type Scenario } from './simulate'

const SLOS = [99.9, 99.5]
const BURN_AXIS = 30

export default function BurnRate() {
  const scenarioId = useId()
  const sloId = useId()
  const [scenario, setScenario] = useState<Scenario>('spike')
  const [slo, setSlo] = useState(99.9)
  const run = useMemo(() => simulateBurn(scenario, slo), [scenario, slo])

  const draw = useCallback(
    ({ ctx, width, height, tokens }: CanvasFrame) => {
      const L = 40
      const R = 20
      const X = (h: number) => L + (h / HOURS) * (width - L - R)
      // Upper panel: burn rate, on a square-root scale so that both 1× and 30× are readable.
      const top = { y: 22, h: height * 0.56 }
      const burnY = (b: number) => top.y + top.h - Math.sqrt(Math.min(b, BURN_AXIS) / BURN_AXIS) * top.h
      ctx.fillStyle = tokens.muted
      ctx.fillText('Hourly burn rate (square-root scale)', L, 14)
      ctx.fillStyle = tokens.accent
      run.burn.forEach((b, h) => {
        const y = burnY(b)
        ctx.fillRect(X(h), y, Math.max(1, (width - L - R) / HOURS), top.y + top.h - y)
      })
      const rules: [number, string, string][] = [
        [TICKET_BURN, `${TICKET_BURN}× ticket`, tokens.signal],
        [SLOW_BURN, `${SLOW_BURN}× slow page`, tokens.bad],
        [FAST_BURN, `${FAST_BURN}× fast page`, tokens.bad],
      ]
      ctx.textAlign = 'right'
      for (const [b, label, color] of rules) {
        ctx.strokeStyle = color
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(L, burnY(b))
        ctx.lineTo(width - R, burnY(b))
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = color
        ctx.fillText(label, width - R, burnY(b) - 3)
      }
      ctx.textAlign = 'left'
      // Alert markers sit on the panel's baseline.
      const markY = top.y + top.h + 4
      for (const a of alertMarkers(run.alerts)) {
        ctx.fillStyle = a.kind === 'ticket' ? tokens.signal : tokens.bad
        ctx.beginPath()
        ctx.moveTo(X(a.hour), markY)
        ctx.lineTo(X(a.hour) - 5, markY + 9)
        ctx.lineTo(X(a.hour) + 5, markY + 9)
        ctx.fill()
      }
      // Lower panel: error budget remaining, on its own axis.
      const low = { y: markY + 34, h: height - markY - 34 - 22 }
      const leftY = (v: number) => low.y + (1 - Math.max(0, Math.min(1, v))) * low.h
      ctx.fillStyle = tokens.muted
      ctx.fillText('Error budget remaining', L, low.y - 8)
      ctx.strokeStyle = tokens.rule
      ctx.lineWidth = 1
      ctx.strokeRect(L, low.y, width - L - R, low.h)
      ctx.textAlign = 'right'
      ctx.fillText('100%', L - 4, low.y + 10)
      ctx.fillText('0%', L - 4, low.y + low.h)
      ctx.strokeStyle = tokens.signal
      ctx.lineWidth = 2
      ctx.beginPath()
      run.remaining.forEach((v, h) => (h ? ctx.lineTo(X(h), leftY(v)) : ctx.moveTo(X(h), leftY(v))))
      ctx.stroke()
      ctx.fillStyle = tokens.muted
      ctx.textAlign = 'center'
      for (const d of [0, 7, 14, 21, 28]) ctx.fillText(`day ${d}`, X(d * 24), height - 4)
    },
    [run],
  )

  const first = (k: AlertKind) => {
    const d = firstAlertDay(run.alerts, k)
    return d === null ? 'none' : `day ${fmt(d, 1)}`
  }
  return (
    <Widget name="burn-rate">
      <div className="row2">
        <label htmlFor={scenarioId}>
          Scenario
          <select id={scenarioId} value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)}>
            {Object.entries(SCENARIOS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={sloId}>
          SLO
          <select id={sloId} value={slo} onChange={(e) => setSlo(+e.target.value)}>
            {SLOS.map((s) => (
              <option key={s} value={s}>
                {s}%
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <Legend
          items={[
            { name: 'Burn rate', color: 'var(--accent)' },
            { name: 'Page (▲ red)', color: 'var(--bad)' },
            { name: 'Ticket (▲ amber)', color: 'var(--signal)' },
            { name: 'Budget remaining', color: 'var(--signal)' },
          ]}
        />
        <ThemeCanvas
          height={320}
          draw={draw}
          label={`Thirty days of hourly burn rate, with alerts, and the error budget remaining. ${pct(run.used)} of the budget is used. First fast page: ${first('fast')}. First slow page: ${first('slow')}. First ticket: ${first('ticket')}.`}
        />
      </div>
      <KpiRow
        items={[
          { label: 'budget used this month', value: pct(run.used), tone: run.used > 1 ? 'bad' : run.used > 0.5 ? 'warn' : 'ok' },
          { label: 'first fast page', value: first('fast') },
          { label: 'first slow page', value: first('slow') },
          { label: 'first ticket', value: first('ticket') },
        ]}
      />
    </Widget>
  )
}
