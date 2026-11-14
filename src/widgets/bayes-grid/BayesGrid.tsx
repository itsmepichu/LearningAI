import { useState } from 'react'
import { Slider, Widget, fmt } from '../kit'
import { bayesCounts, cellKinds } from './model'

const STYLE = {
  caught: { background: 'var(--bad)' },
  missed: { background: 'var(--surface)', boxShadow: 'inset 0 0 0 1.5px var(--bad)' },
  alarm: { background: 'var(--signal)' },
  rest: { background: 'var(--sunk)' },
} as const

export default function BayesGrid() {
  const [prior, setPrior] = useState(10)
  const [recall, setRecall] = useState(95)
  const [fpr, setFpr] = useState(20)
  const c = bayesCounts({ priorPerMille: prior, recallPercent: recall, fprPerMille: fpr })
  return (
    <Widget name="bayes-grid">
      <div className="row2">
        <Slider label="Base rate (fraud)" value={prior} min={1} max={200} onChange={setPrior} format={(n) => `${fmt(n / 10, 1)}%`} />
        <Slider label="Recall (true positive rate)" value={recall} min={50} max={100} onChange={setRecall} format={(n) => `${n}%`} />
        <Slider label="False positive rate" value={fpr} min={0} max={200} onChange={setFpr} format={(n) => `${fmt(n / 10, 1)}%`} />
      </div>
      <div role="img" aria-label={`1,000 transactions: ${c.caught} fraud caught, ${c.missed} fraud missed, ${c.falseAlarms} false alarms.`} style={{ display: 'grid', gridTemplateColumns: 'repeat(50, 1fr)', gap: 1, maxWidth: 600 }}>
        {cellKinds(c).map((k, i) => (
          <i key={i} style={{ display: 'block', aspectRatio: '1', borderRadius: 1, ...STYLE[k] }} />
        ))}
      </div>
      <div className="out">
        <div>Fraud cases: {c.fraud} · caught: {c.caught} · missed: {c.missed} · false alarms: {c.falseAlarms}</div>
        <div>P(fraud | flagged) = {c.caught} / ({c.caught} + {c.falseAlarms}) = {fmt(c.precision * 100, 1)}% ← precision</div>
        <div>P(flagged | fraud) = {recall}% ← recall (what the model card advertises)</div>
      </div>
    </Widget>
  )
}
