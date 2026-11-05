import { useId, useState } from 'react'
import { DataGate, DataSource, KpiRow, Slider, Widget, fmt, pct, useProjectData } from '../kit'
import { asInputTokens, compact, estimateTokens, requestCost, usd } from './estimate'
import { loadSamples, type Sample } from './samples'

function TextBox({ samples, onUse }: { samples: Sample[]; onUse: (tokens: number) => void }) {
  const id = useId()
  const [text, setText] = useState(samples[0]?.text ?? '')
  const tokens = estimateTokens(text)
  return (
    <>
      <label htmlFor={id} className="wk-q-in">
        Paste any text to estimate its tokens
        <textarea id={id} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="wk-chips">
        <span>Try a message in</span>
        {samples.map((s) => (
          <button key={s.language} type="button" className="wk-chip" aria-pressed={s.text === text} onClick={() => setText(s.text)}>
            {s.language}
          </button>
        ))}
      </div>
      <div className="ctl">
        <span className="count wk-count-l">
          {fmt([...text].length)} characters, about {fmt(tokens)} tokens (heuristic)
        </span>
        <button type="button" className="btn" onClick={() => onUse(asInputTokens(tokens))}>
          Use as input tokens
        </button>
      </div>
    </>
  )
}

export default function TokenEstimator() {
  const [inputTokens, setInput] = useState(3000)
  const [outputTokens, setOutput] = useState(350)
  const [logRequests, setLogRequests] = useState(4)
  const [inputPrice, setInputPrice] = useState(1)
  const [outputPrice, setOutputPrice] = useState(4)
  const [decodeSpeed, setDecodeSpeed] = useState(60)
  const state = useProjectData(loadSamples)
  const c = requestCost({ inputTokens, outputTokens, requestsPerDay: Math.round(10 ** logRequests), inputPrice, outputPrice, decodeSpeed })
  return (
    <Widget name="token-estimator">
      <DataGate state={state}>
        {({ file, samples }, project) => (
          <>
            <DataSource project={project} files={[file]}>
              The messages come from the dataset. Prices and speeds are illustrative inputs.
            </DataSource>
            {/* A new project brings new messages, so edits to the old text are not carried over. */}
            <TextBox key={project.id} samples={samples} onUse={setInput} />
          </>
        )}
      </DataGate>
      <div className="row2">
        <Slider label="Input tokens per request" value={inputTokens} min={100} max={20000} step={100} format={(v) => fmt(v)} onChange={setInput} />
        <Slider label="Output tokens per request" value={outputTokens} min={20} max={4000} step={10} format={(v) => fmt(v)} onChange={setOutput} />
        <Slider label="Requests per day" value={logRequests} min={2} max={6.5} step={0.05} format={(v) => compact(Math.round(10 ** v))} onChange={setLogRequests} />
        <Slider label="Input price ($ per M tokens)" value={inputPrice} min={0.05} max={15} step={0.05} format={(v) => `$${fmt(v, 2)}`} onChange={setInputPrice} />
        <Slider label="Output price ($ per M tokens)" value={outputPrice} min={0.1} max={60} step={0.1} format={(v) => `$${fmt(v, 2)}`} onChange={setOutputPrice} />
        <Slider label="Decode speed (tokens/s)" value={decodeSpeed} min={5} max={200} onChange={setDecodeSpeed} />
      </div>
      <KpiRow
        items={[
          { label: 'cost per request', value: usd(c.perRequest) },
          { label: 'cost per day', value: usd(c.perDay) },
          { label: 'cost per month (30 days)', value: usd(c.perMonth) },
          { label: 'output share of cost', value: pct(c.outputShare) },
          { label: 'time to first token', value: `${fmt(c.ttft, 2)} s` },
          { label: 'total response time', value: `${fmt(c.total, 1)} s`, tone: c.total > 10 ? 'warn' : undefined },
        ]}
      />
    </Widget>
  )
}
