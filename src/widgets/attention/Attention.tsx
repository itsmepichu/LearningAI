import { useId, useState, type CSSProperties } from 'react'
import { ScrollRegion, Slider, Widget, fmt } from '../kit'
import { HEADS, TOKENS, attentionWeights, describeRow } from './weights'

/** The strongest cell is 45% accent, which keeps ink text above AA contrast in both themes. */
const shade = (w: number): CSSProperties => ({ background: `color-mix(in srgb,var(--accent) ${Math.round(w * 45)}%,var(--surface))` })

export default function Attention() {
  const headId = useId()
  const [causal, setCausal] = useState(true)
  const [head, setHead] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [selected, setSelected] = useState(4)
  const weights = attentionWeights(head, causal, scale)
  return (
    <Widget name="attention">
      <div className="row2">
        <label>
          <input type="checkbox" checked={causal} onChange={(e) => setCausal(e.target.checked)} />
          Causal mask
        </label>
        <label htmlFor={headId}>
          Head
          <select id={headId} value={head} onChange={(e) => setHead(+e.target.value)}>
            {HEADS.map((h, i) => (
              <option key={h} value={i}>
                {i + 1} · {h}
              </option>
            ))}
          </select>
        </label>
        <Slider label="Score scale" value={scale} min={0.2} max={4} step={0.1} format={(v) => fmt(v, 1)} onChange={setScale} />
      </div>
      <ScrollRegion label="Attention weights, as percentages">
        <table className="wk-matrix">
          <thead>
            <tr>
              <th>Query → key</th>
              {TOKENS.map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weights.map((row, i) => (
              <tr key={TOKENS[i]}>
                <th scope="row">
                  <button type="button" className="wk-rowpick" aria-pressed={i === selected} onClick={() => setSelected(i)}>
                    {TOKENS[i]}
                  </button>
                </th>
                {row.map((w, j) =>
                  causal && j > i ? (
                    <td key={j} className="wk-c-na">
                      –
                    </td>
                  ) : (
                    <td key={j} style={shade(w)}>
                      {fmt(w * 100)}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      <div className="out">
        “{TOKENS[selected]}” attends to:{' '}
        {describeRow(weights[selected])
          .map((x) => `${x.token} ${fmt(x.weight * 100)}%`)
          .join(' · ')}
        {causal ? ' (future tokens masked)' : ''}
      </div>
    </Widget>
  )
}
