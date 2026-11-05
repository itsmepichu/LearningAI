import { useState } from 'react'
import { BarList, KpiRow, Slider, Widget, fmt, pct, usd } from '../kit'
import { prefixCost } from './cost'

const ms = (s: number) => `${fmt(s * 1000)} ms`

export default function PrefixCache() {
  const [prefixTokens, setPrefix] = useState(6000)
  const [uniqueTokens, setUnique] = useState(800)
  const [hitRate, setHitRate] = useState(0.8)
  const [speed, setSpeed] = useState(10000)
  const [price, setPrice] = useState(3)
  const [discount, setDiscount] = useState(0.9)
  const c = prefixCost({ prefixTokens, uniqueTokens, hitRate, speed, price, discount })
  const tokens = (v: number) => fmt(v)
  return (
    <Widget name="prefix-cache">
      <div className="row2">
        <Slider label="Shared prefix (system + tools, tokens)" value={prefixTokens} min={0} max={20000} step={250} format={tokens} onChange={setPrefix} />
        <Slider label="Unique tokens per request" value={uniqueTokens} min={50} max={8000} step={50} format={tokens} onChange={setUnique} />
        <Slider label="Cache hit rate" value={hitRate} min={0} max={1} step={0.01} format={(v) => pct(v)} onChange={setHitRate} />
        <Slider label="Prefill speed (tokens/s)" value={speed} min={1000} max={40000} step={500} format={tokens} onChange={setSpeed} />
        <Slider label="Input price ($ per M tokens)" value={price} min={0.1} max={15} step={0.1} format={(v) => `$${fmt(v, 2)}`} onChange={setPrice} />
        <Slider label="Cached-token discount" value={discount} min={0} max={1} step={0.01} format={(v) => pct(v)} onChange={setDiscount} />
      </div>
      <KpiRow
        items={[
          { label: 'first token on a hit', value: ms(c.ttftHit) },
          { label: 'first token on a miss', value: ms(c.ttftMiss) },
          { label: 'average first token', value: ms(c.ttftAverage), tone: c.ttftAverage < 0.5 ? 'ok' : c.ttftAverage > 1.5 ? 'warn' : undefined },
          { label: 'input cost per 1,000 requests', value: usd(c.costPerThousand) },
          { label: 'saving against no cache', value: pct(c.saving), tone: 'ok' },
        ]}
      />
      <BarList
        max={Math.max(c.ttftMiss, 0.001)}
        items={[
          { label: 'No prefix cache', value: c.ttftMiss, text: ms(c.ttftMiss), color: 'var(--bad)' },
          { label: 'With the cache, at this hit rate', value: c.ttftAverage, text: ms(c.ttftAverage), color: 'var(--ok)' },
        ]}
      />
    </Widget>
  )
}
