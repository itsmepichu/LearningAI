import { useState } from 'react'
import { DataGate, DataSource, KpiRow, Legend, ScrollRegion, Slider, StackBar, Widget, fmt, useProjectData, type StackSegment } from '../kit'
import { assemble, type ItemKind } from './assemble'
import { loadContextItems } from './scenarios'

const KINDS: Record<ItemKind, { name: string; color: string }> = {
  instructions: { name: 'Instructions', color: 'var(--accent)' },
  live: { name: 'Live data', color: 'var(--signal)' },
  conversation: { name: 'Conversation', color: 'var(--sim)' },
  retrieved: { name: 'Retrieved', color: 'var(--ok)' },
}

export default function ContextAssembler() {
  const [budget, setBudget] = useState(8000)
  const [reserve, setReserve] = useState(1000)
  const [compress, setCompress] = useState(false)
  const state = useProjectData(loadContextItems)
  return (
    <Widget name="context-assembler">
      <DataGate state={state}>
        {({ file, items }, project) => {
          const a = assemble(items, budget, reserve, compress)
          const segments: StackSegment[] = [
            ...a.rows.filter((r) => r.included).map((r) => ({ name: r.name, size: r.size, color: KINDS[r.kind].color })),
            { name: 'Free', size: a.free, color: 'var(--sunk)' },
            { name: 'Reserved for output', size: a.reserved, hatched: true },
          ]
          return (
            <>
              <DataSource project={project} files={[file]}>
                Chunk titles come from the dataset. Token sizes and scores are illustrative.
              </DataSource>
              <div className="row2">
                <Slider label="Context window budget (tokens)" value={budget} min={2000} max={16000} step={500} format={(v) => fmt(v)} onChange={setBudget} />
                <Slider label="Reserved for output" value={reserve} min={200} max={4000} step={100} format={(v) => fmt(v)} onChange={setReserve} />
                <label>
                  <input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} />
                  Compress history and long documents
                </label>
              </div>
              <div>
                <Legend items={[...Object.values(KINDS), { name: 'Free', color: 'var(--sunk)' }, { name: 'Output reserve', color: 'var(--rule-2)' }]} />
                <StackBar total={budget} segments={segments} label={`${fmt(a.used)} tokens used, ${fmt(a.free)} free and ${fmt(a.reserved)} reserved for output, of ${fmt(budget)}.`} />
              </div>
              <KpiRow
                items={[
                  { label: 'tokens used', value: fmt(a.used) },
                  { label: 'tokens free', value: fmt(a.free) },
                  { label: 'reserved for output', value: fmt(a.reserved) },
                  { label: 'items dropped', value: fmt(a.rows.filter((r) => !r.included).length) },
                  { label: 'must-have items dropped', value: fmt(a.droppedMust), tone: a.droppedMust ? 'bad' : 'ok' },
                ]}
              />
              <ScrollRegion label="Context items and whether each is included">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Priority</th>
                      <th>Tokens</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.rows.map((r) => (
                      <tr key={r.name}>
                        <td>
                          <i className="wk-sw" style={{ background: KINDS[r.kind].color }} aria-hidden="true" />
                          {r.name}
                        </td>
                        <td>{r.priority === 0 ? 'must' : r.priority}</td>
                        <td>
                          {fmt(r.size)}
                          {r.isCompressed && <span className="wk-from"> (from {fmt(r.tokens)})</span>}
                        </td>
                        <td className={r.included ? 'wk-yes' : 'wk-no'}>{r.included ? 'included' : 'dropped'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollRegion>
            </>
          )
        }}
      </DataGate>
    </Widget>
  )
}
