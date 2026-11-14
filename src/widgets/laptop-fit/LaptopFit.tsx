import { useId, useState } from 'react'
import { KpiRow, Slider, Widget, bytesText, fmt } from '../kit'
import { FORMATS, MODELS, RUNTIME_BYTES, fit } from './model'

export default function LaptopFit() {
  const ids = [useId(), useId(), useId()]
  const [model, setModel] = useState(2)
  const [format, setFormat] = useState(3)
  const [ramGb, setRam] = useState(16)
  const [osGb, setOs] = useState(5)
  const [ctxExp, setCtx] = useState(13)
  const [bandwidthGb, setBw] = useState(70)
  const f = fit({ model, format, ramGb, osGb, ctxExp, bandwidthGb })
  const total = Math.max(f.ram, f.os + f.need)
  const seg = (v: number, color: string, title: string) => <div key={title} title={title} style={{ width: `${Math.max(0, (v / total) * 100)}%`, background: color, opacity: 0.8, borderRight: '1px solid var(--surface)' }} />
  const tone = f.verdict === 'comfortable' ? 'ok' : f.verdict === 'tight' ? 'warn' : 'bad'
  return (
    <Widget name="laptop-fit">
      <div className="row2">
        <label htmlFor={ids[0]}>Model <select id={ids[0]} value={model} onChange={(e) => setModel(+e.target.value)}>{MODELS.map((m, i) => <option key={m.name} value={i}>{m.name}</option>)}</select></label>
        <label htmlFor={ids[1]}>Weights format <select id={ids[1]} value={format} onChange={(e) => setFormat(+e.target.value)}>{FORMATS.map((m, i) => <option key={m.name} value={i}>{m.name}</option>)}</select></label>
        <label htmlFor={ids[2]}>Laptop RAM <select id={ids[2]} value={ramGb} onChange={(e) => setRam(+e.target.value)}>{[8, 16, 32, 64].map((g) => <option key={g} value={g}>{g}</option>)}</select> GB</label>
        <Slider label="Used by OS + apps (GB)" value={osGb} min={2} max={14} onChange={setOs} format={(v) => `${v} GB`} />
        <Slider label="Context (tokens)" value={ctxExp} min={11} max={17} onChange={setCtx} format={(v) => `${fmt(2 ** v)} tokens`} />
        <Slider label="Memory bandwidth (GB/s)" value={bandwidthGb} min={20} max={400} step={10} onChange={setBw} format={(v) => `${v} GB/s`} />
      </div>
      <div style={{ display: 'flex', height: 30, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--rule)' }} role="img" aria-label={`Memory: ${bytesText(f.os)} OS and apps, ${bytesText(f.weights)} weights, ${bytesText(f.kv)} KV cache. Verdict: ${f.verdict === 'no' ? 'does not fit' : f.verdict === 'tight' ? 'fits, but tight' : 'fits comfortably'}.`}>
        {seg(f.os, 'var(--muted)', 'OS + apps')}
        {seg(f.weights, 'var(--accent)', 'weights')}
        {seg(f.kv, 'var(--signal)', 'KV cache')}
        {seg(RUNTIME_BYTES, 'var(--sim)', 'runtime')}
        {f.free > 0 ? seg(f.free, 'var(--sunk)', 'free') : <div title="does not fit" style={{ flex: 1, background: 'repeating-linear-gradient(45deg,var(--bad) 0 6px,var(--bad-soft) 6px 12px)' }} />}
      </div>
      <KpiRow
        items={[
          { label: 'weights', value: bytesText(f.weights) },
          { label: 'KV cache at this context', value: bytesText(f.kv) },
          { label: 'total needed (+0.4 GB runtime)', value: bytesText(f.need) },
          { label: 'verdict', value: f.verdict === 'comfortable' ? 'fits comfortably' : f.verdict === 'tight' ? 'fits, but tight' : 'does not fit', tone },
          { label: 'decode speed ceiling', value: f.free > 0 ? `≤ ${fmt(f.speed, f.speed < 10 ? 1 : 0)} tokens/s` : '–' },
        ]}
      />
    </Widget>
  )
}
