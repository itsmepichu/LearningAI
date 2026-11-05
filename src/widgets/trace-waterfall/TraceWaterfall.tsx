import { useState } from 'react'
import { DataGate, DataSource, Legend, TimeBars, Widget, fmt, useProjectData } from '../kit'
import { TRACE_MS, describeSpan, loadTrace, type Span, type SpanKind } from './spans'

const KINDS: Record<SpanKind, { name: string; color: string }> = {
  model: { name: 'Model call', color: 'var(--sim)' },
  tool: { name: 'Tool', color: 'var(--signal)' },
  retrieval: { name: 'Retrieval', color: 'var(--accent)' },
  other: { name: 'Other', color: 'var(--muted)' },
}

function Trace({ spans }: { spans: Span[] }) {
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <>
      <Legend items={Object.values(KINDS)} />
      <TimeBars
        total={TRACE_MS}
        selected={picked}
        onSelect={setPicked}
        axis={['0', '2.7 s', '5.4 s']}
        bars={spans.map((s) => ({ label: s.name, start: s.start, duration: s.duration, indent: s.depth, color: KINDS[s.kind].color, value: `${fmt(s.duration)} ms` }))}
      />
      <div className="out" aria-live="polite">
        {picked === null ? 'Select a span to see its attributes.' : describeSpan(spans[picked])}
      </div>
    </>
  )
}

export default function TraceWaterfall() {
  const state = useProjectData(loadTrace)
  return (
    <Widget name="trace-waterfall">
      <DataGate state={state}>
        {({ file, spans }, project) => (
          <>
            <DataSource project={project} files={[file]}>
              An example trace with illustrative timings. The tool’s reference comes from the dataset.
            </DataSource>
            <Trace key={project.id} spans={spans} />
          </>
        )}
      </DataGate>
    </Widget>
  )
}
