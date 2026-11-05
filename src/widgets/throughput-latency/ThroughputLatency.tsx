import { useMemo, useState } from 'react'
import { KpiRow, LineChart, SERIES, Slider, Widget, fmt } from '../kit'
import { ITL_AXIS_MS, ITL_SLO_MS, MAX_BATCH, bestUnderSlo, perUserSpeed, stepMs, throughput } from './roofline'

const XS = Array.from({ length: MAX_BATCH }, (_, i) => i + 1)
const TICKS = [1, 64, 128, 192, 256]

export default function ThroughputLatency() {
  const [batch, setBatch] = useState(32)
  const best = bestUnderSlo()
  const top = throughput(MAX_BATCH) * 1.1
  const throughputs = useMemo(() => XS.map((b) => throughput(b) / top), [top])
  const latencies = useMemo(() => XS.map((b) => stepMs(b) / ITL_AXIS_MS), [])
  return (
    <Widget name="throughput-latency">
      <Slider label="Max batch size (concurrent sequences)" value={batch} min={1} max={MAX_BATCH} onChange={setBatch} />
      <KpiRow
        items={[
          { label: 'throughput', value: `${fmt(throughput(batch))} tok/s` },
          { label: 'inter-token latency per user', value: `${fmt(stepMs(batch), 1)} ms`, tone: stepMs(batch) > ITL_SLO_MS ? 'bad' : 'ok' },
          { label: 'per-user speed', value: `${fmt(perUserSpeed(batch), 1)} tok/s` },
          { label: `largest batch under ${ITL_SLO_MS} ms`, value: best },
        ]}
      />
      <div className="cols2">
        <div>
          <span className="wk-stream-h">Throughput (tokens/s)</span>
          <LineChart
            x={XS}
            xTicks={TICKS}
            marker={batch}
            xLabel="concurrent sequences"
            format={(v) => fmt(v * top)}
            height={200}
            label={`Throughput rises with batch size, reaching ${fmt(throughput(batch))} tokens per second at ${batch} sequences.`}
            series={[{ name: 'Throughput', color: SERIES[0], values: throughputs }]}
          />
        </div>
        <div>
          <span className="wk-stream-h">Inter-token latency (ms)</span>
          <LineChart
            x={XS}
            xTicks={TICKS}
            marker={batch}
            reference={{ value: ITL_SLO_MS / ITL_AXIS_MS, label: `SLO ${ITL_SLO_MS} ms` }}
            xLabel="concurrent sequences"
            format={(v) => fmt(v * ITL_AXIS_MS)}
            height={200}
            label={`Latency rises with batch size, reaching ${fmt(stepMs(batch), 1)} ms at ${batch} sequences. The ${ITL_SLO_MS} ms target is met up to ${best} sequences.`}
            series={[{ name: 'Latency', color: SERIES[1], values: latencies }]}
          />
        </div>
      </div>
      <p className="wk-hint">Assumes an 8B model in BF16 on a 3.35 TB/s GPU, with an average context of 6,000 tokens.</p>
    </Widget>
  )
}
