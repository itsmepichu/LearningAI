import { Widget, fmt, useWidth } from '../kit'
import { CALIBRATED, OVERCONFIDENT, ece, type Bin } from './bins'

const M = { left: 42, right: 12, top: 26, bottom: 40 }
const HEIGHT = 260

function Diagram({ title, bins, good }: { title: string; bins: Bin[]; good: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const iw = Math.max(0, width - M.left - M.right)
  const ih = HEIGHT - M.top - M.bottom
  const X = (v: number) => M.left + v * iw
  const Y = (v: number) => M.top + (1 - v) * ih
  const heading = `${title} (ECE ≈ ${fmt(ece(bins), 2)})`
  return (
    <div ref={ref} className="wk-chart" style={{ height: HEIGHT }}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={`${heading}. Bars ${good ? 'follow' : 'fall below'} the diagonal.`}>
          <text x={M.left} y={14} className="wk-end" style={{ fill: good ? 'var(--ok)' : 'var(--bad)', fontWeight: 600 }}>
            {heading}
          </text>
          <rect x={M.left} y={M.top} width={iw} height={ih} fill="var(--sunk)" />
          {bins.map((b) => (
            <rect
              key={b.predicted}
              x={X(b.predicted - 0.05) + 1}
              y={Y(b.observed)}
              width={Math.max(0, iw / 10 - 2)}
              height={Math.max(0, b.observed * ih)}
              rx={2}
              style={{ fill: b.off ? 'var(--bad-soft)' : 'var(--ok-soft)', stroke: b.off ? 'var(--bad)' : 'var(--ok)' }}
            />
          ))}
          <line className="wk-mark" x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} />
          {[0, 1].map((t) => (
            <text key={t} className="wk-tick" x={X(t)} y={M.top + ih + 16} textAnchor="middle">
              {t}
            </text>
          ))}
          <text className="wk-tick" x={M.left + iw / 2} y={HEIGHT - 4} textAnchor="middle">
            predicted probability
          </text>
          <text className="wk-tick" transform={`translate(12 ${M.top + ih / 2}) rotate(-90)`} textAnchor="middle">
            observed frequency
          </text>
        </svg>
      )}
    </div>
  )
}

export default function Reliability() {
  return (
    <Widget name="reliability">
      <div className="cols2">
        <Diagram title="Over-confident" bins={OVERCONFIDENT} good={false} />
        <Diagram title="After calibration" bins={CALIBRATED} good />
      </div>
    </Widget>
  )
}
