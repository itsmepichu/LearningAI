import { useId, useState } from 'react'
import { KpiRow, ScrollRegion, Widget, si } from '../kit'
import { PRESETS, trace, type PresetId, type Shape } from './shapes'

type NumKey = 'd' | 'heads' | 'kv' | 'layers' | 'ffn' | 'vocab' | 'seq' | 'batch'

export default function ShapeTracer() {
  const id = useId()
  const [preset, setPreset] = useState<PresetId>('l8')
  const [s, setS] = useState<Shape>({ ...PRESETS.l8, seq: 2048, batch: 1 })
  const choose = (p: PresetId) => {
    setPreset(p)
    setS((cur) => ({ ...cur, ...PRESETS[p] }))
  }
  const num = (key: NumKey, label: string, min: number, step = 1, width = 80) => (
    <label htmlFor={`${id}${key}`}>
      {label}{' '}
      <input id={`${id}${key}`} type="number" value={s[key]} min={min} step={step} style={{ width }} onChange={(e) => setS((cur) => ({ ...cur, [key]: Math.max(min, +e.target.value || min) }))} />
    </label>
  )
  const t = trace(s)
  return (
    <Widget name="shape-tracer">
      <div className="row2">
        <label htmlFor={`${id}p`}>
          Preset{' '}
          <select id={`${id}p`} value={preset} onChange={(e) => choose(e.target.value as PresetId)}>
            {(Object.keys(PRESETS) as PresetId[]).map((k) => <option key={k} value={k}>{PRESETS[k].name}</option>)}
          </select>
        </label>
        {num('d', 'd_model', 64, 64, 90)}
        {num('heads', 'heads', 1, 1, 70)}
        {num('kv', 'KV heads', 1, 1, 70)}
        {num('layers', 'layers', 1, 1, 70)}
        {num('ffn', 'FFN width', 64, 64, 90)}
        {num('vocab', 'vocab', 100, 1, 100)}
        <label htmlFor={`${id}f`}>
          FFN type{' '}
          <select id={`${id}f`} value={s.ffnMats} onChange={(e) => setS((cur) => ({ ...cur, ffnMats: +e.target.value as 2 | 3 }))}>
            <option value={3}>SwiGLU (3 matrices)</option>
            <option value={2}>GELU (2 matrices)</option>
          </select>
        </label>
        <label htmlFor={`${id}t`}>
          <input id={`${id}t`} type="checkbox" checked={s.tied} onChange={(e) => setS((cur) => ({ ...cur, tied: e.target.checked }))} /> tied input/output embeddings
        </label>
        {num('seq', 'sequence', 1, 1, 80)}
        {num('batch', 'batch', 1, 1, 60)}
      </div>
      <ScrollRegion label="Shapes and parameters for one forward pass">
        <table>
          <thead><tr><th>Step</th><th>Operation</th><th>Output shape</th><th>Parameters</th></tr></thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.step}>
                <td>{r.step}</td>
                <td><code>{r.op}</code></td>
                <td style={{ fontFamily: 'var(--f-mono)', fontSize: '.78rem' }}>{r.shape}</td>
                <td>{r.tied ? 'shared with embeddings' : r.both ? `${si(r.params)} (both)` : si(r.params)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      <KpiRow
        items={[
          { label: 'head dimension', value: t.divisible ? t.dh : `${t.dh} (d not divisible!)`, tone: t.divisible ? undefined : 'bad' },
          { label: 'attention params / layer', value: si(t.attn) },
          { label: 'FFN params / layer', value: si(t.ffn) },
          { label: 'all layers', value: si(s.layers * t.block, 2) },
          { label: 'total parameters', value: si(t.total, 2), tone: 'ok' },
          { label: 'attention score elements / layer', value: si(t.scoreElements) },
        ]}
      />
    </Widget>
  )
}
