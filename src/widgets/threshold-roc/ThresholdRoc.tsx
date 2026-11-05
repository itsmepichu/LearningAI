import { useMemo, useState } from 'react'
import { KpiRow, ScrollRegion, Slider, Widget, fmt, pct, useWidth } from '../kit'
import { curves, makeScores, metricsAt, type XY } from './curves'

const M = { left: 42, right: 12, top: 26, bottom: 40 }
const HEIGHT = 260

function Curve({ title, xLabel, yLabel, points, dot, diagonal }: { title: string; xLabel: string; yLabel: string; points: XY[]; dot: XY; diagonal?: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const iw = Math.max(0, width - M.left - M.right)
  const ih = HEIGHT - M.top - M.bottom
  const X = (v: number) => M.left + v * iw
  const Y = (v: number) => M.top + (1 - v) * ih
  return (
    <div ref={ref} className="wk-chart" style={{ height: HEIGHT }}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={`${title}. ${xLabel} against ${yLabel}. The current threshold is at ${fmt(dot[0], 2)}, ${fmt(dot[1], 2)}.`}>
          <text className="wk-end" x={M.left} y={14}>
            {title}
          </text>
          <rect x={M.left} y={M.top} width={iw} height={ih} fill="var(--sunk)" />
          {diagonal && <line className="wk-mark" x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} />}
          <polyline className="wk-line" style={{ stroke: 'var(--accent)' }} points={points.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ')} />
          <circle className="wk-dot" style={{ fill: 'var(--signal)' }} cx={X(dot[0])} cy={Y(dot[1])} r={6} />
          {[0, 1].map((t) => (
            <g key={t}>
              <text className="wk-tick" x={X(t)} y={M.top + ih + 16} textAnchor="middle">
                {t}
              </text>
              <text className="wk-tick" x={M.left - 6} y={Y(t) + 4} textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          <text className="wk-tick" x={M.left + iw / 2} y={HEIGHT - 4} textAnchor="middle">
            {xLabel}
          </text>
          <text className="wk-tick" transform={`translate(12 ${M.top + ih / 2}) rotate(-90)`} textAnchor="middle">
            {yLabel}
          </text>
        </svg>
      )}
    </div>
  )
}

export default function ThresholdRoc() {
  const [t, setT] = useState(0.5)
  const scores = useMemo(() => makeScores(), [])
  const { roc, pr, auc } = useMemo(() => curves(scores), [scores])
  const m = metricsAt(scores, t)
  return (
    <Widget name="threshold-roc">
      <Slider label="Decision threshold" value={t} min={0} max={1} step={0.01} format={(v) => fmt(v, 2)} onChange={setT} />
      <div className="cols2">
        <ScrollRegion label="Confusion matrix">
          <table>
            <thead>
              <tr>
                <th>Prediction</th>
                <th>Actual +</th>
                <th>Actual −</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Predicted +</th>
                <td className="wk-c-pass">TP {m.tp}</td>
                <td className="wk-c-warn">FP {m.fp}</td>
              </tr>
              <tr>
                <th scope="row">Predicted −</th>
                <td className="wk-c-fail">FN {m.fn}</td>
                <td>TN {m.tn}</td>
              </tr>
            </tbody>
          </table>
        </ScrollRegion>
        <KpiRow
          items={[
            { label: 'precision', value: pct(m.precision, 1) },
            { label: 'recall', value: pct(m.recall, 1) },
            { label: 'F1', value: fmt(m.f1, 3) },
            { label: 'accuracy', value: pct(m.accuracy, 1) },
            { label: 'false positive rate', value: pct(m.falsePositiveRate, 1) },
            { label: 'ROC AUC (all thresholds)', value: fmt(auc, 3) },
          ]}
        />
      </div>
      <div className="cols2">
        <Curve title="ROC curve" xLabel="false positive rate" yLabel="true positive rate" points={roc} dot={[m.falsePositiveRate, m.recall]} diagonal />
        <Curve title="Precision–recall curve" xLabel="recall" yLabel="precision" points={pr} dot={[m.recall, m.precision]} />
      </div>
    </Widget>
  )
}
