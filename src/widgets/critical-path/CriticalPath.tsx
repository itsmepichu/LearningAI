import { useState } from 'react'
import { DataSource, KpiRow, Legend, Slider, TimeBars, Widget, fmt, pct, useProject } from '../kit'
import { DEFAULTS, criticalPath, type PathKind, type Timings } from './path'

const KINDS: Record<PathKind, { name: string; color: string }> = {
  retrieval: { name: 'Retrieval', color: 'var(--accent)' },
  model: { name: 'Model call', color: 'var(--sim)' },
  tool: { name: 'Tool', color: 'var(--signal)' },
  timeout: { name: 'Timeout', color: 'var(--bad)' },
}
const TOOL_NAME: Record<string, string> = { harbor: 'get_ticket', store: 'get_order', bank: 'get_case', travel: 'get_booking' }
const ms = (v: number) => `${fmt(v)} ms`

export default function CriticalPath() {
  const project = useProject()
  const [t, setT] = useState<Timings>(DEFAULTS)
  const set = (key: keyof Timings) => (v: number) => setT((old) => ({ ...old, [key]: v }))
  const { spans, total, longest, offPath } = criticalPath(t, TOOL_NAME[project.id])
  const end = Math.round(total / 100) / 10
  return (
    <Widget name="critical-path">
      <DataSource project={project} files={[]}>
        Timings are illustrative. {project.assistant}’s tool call is {TOOL_NAME[project.id]}.
      </DataSource>
      <div className="row2">
        <Slider label="Query rewrite" value={t.rewrite} min={0} max={1500} step={50} format={ms} onChange={set('rewrite')} />
        <Slider label="BM25" value={t.bm25} min={10} max={800} step={10} format={ms} onChange={set('bm25')} />
        <Slider label="Vector search" value={t.vector} min={10} max={800} step={10} format={ms} onChange={set('vector')} />
        <Slider label="Rerank" value={t.rerank} min={0} max={2000} step={50} format={ms} onChange={set('rerank')} />
        <Slider label="Model call 1" value={t.model1} min={100} max={4000} step={50} format={ms} onChange={set('model1')} />
        <Slider label="Tool call" value={t.tool} min={20} max={2000} step={10} format={ms} onChange={set('tool')} />
        <Slider label="Model call 2" value={t.model2} min={100} max={6000} step={50} format={ms} onChange={set('model2')} />
        <label>
          <input type="checkbox" checked={t.toolRetry} onChange={(e) => setT((old) => ({ ...old, toolRetry: e.target.checked }))} />
          Tool times out once (2 s) and retries
        </label>
      </div>
      <Legend items={Object.values(KINDS)} />
      <TimeBars
        total={total}
        axis={['0', `${fmt(end / 2, 1)} s`, `${fmt(end, 1)} s`]}
        bars={spans.map((s) => ({ label: s.name, start: s.start, duration: s.duration, indent: s.parallel ? 1 : 0, color: KINDS[s.kind].color, off: !s.critical, value: s.critical ? ms(s.duration) : `${ms(s.duration)}, off path` }))}
      />
      <KpiRow
        items={[
          { label: 'end to end', value: `${fmt(total / 1000, 2)} s`, tone: total > 8000 ? 'bad' : total > 5000 ? 'warn' : undefined },
          { label: 'longest critical span', value: longest.name },
          { label: 'its share of the total', value: pct(longest.duration / total) },
          { label: 'off the critical path', value: offPath },
        ]}
      />
    </Widget>
  )
}
