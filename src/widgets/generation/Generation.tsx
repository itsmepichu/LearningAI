import { useState } from 'react'
import { BarList, StepPlayer, Widget } from '../kit'
import { PROMPT, STEPS } from './steps'

/** Greedy generation, one token at a time. The probabilities are illustrative. */
export default function Generation() {
  // i is how many tokens have been appended so far; the last state (i = 6) is "generation stopped"
  const [i, setI] = useState(0)
  const done = STEPS.slice(0, i).map((s) => s.token).join('')
  const finished = i >= STEPS.length
  return (
    <Widget name="generation">
      <div className="out" style={{ fontSize: '.95rem' }}>
        <span style={{ color: 'var(--muted)' }}>{PROMPT}</span>
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{done}</span>
        <span aria-hidden="true">▌</span>
      </div>
      {!finished && (
        <BarList max={100} items={STEPS[i].top.map(([t, p], k) => ({ label: `candidate ${t.replace(/ /g, '␣')}`, value: p * 100, text: `${Math.round(p * 100)}%`, color: k ? undefined : 'var(--ok)' }))} />
      )}
      <StepPlayer count={STEPS.length + 1} step={i} onStep={setI} intervalMs={1300} noun="State" />
      <p className="count" aria-live="polite">
        {finished ? 'End-of-sequence token chosen: generation stops.' : `Step ${i + 1}: the model scores every token; the top three are shown, and greedy decoding picks the first. Probabilities here are illustrative.`}
      </p>
    </Widget>
  )
}
