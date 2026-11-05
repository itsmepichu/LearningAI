import { useState, type CSSProperties } from 'react'
import { Legend, Widget } from '../kit'
import { BLOCK_SIZE, POOL_BLOCKS, blocksInUse, initPool, stepPool, type Owner } from './pool'

const COLOR: Record<Owner, string> = { shared: 'var(--sim)', A: 'var(--accent)', B: 'var(--signal)', C: 'var(--ok)' }

export default function PagedKv() {
  const [share, setShare] = useState(true)
  const [pool, setPool] = useState(() => initPool(true))
  const used = blocksInUse(pool)
  const full = used >= POOL_BLOCKS
  return (
    <Widget name="paged-kv">
      <div className="ctl">
        <button type="button" className="btn primary" disabled={full} onClick={() => setPool(stepPool(pool))}>
          Next decode step
        </button>
        <button type="button" className="btn" onClick={() => setPool(initPool(share))}>
          Reset
        </button>
        <label>
          <input
            type="checkbox"
            checked={share}
            onChange={(e) => {
              setShare(e.target.checked)
              setPool(initPool(e.target.checked))
            }}
          />
          Share the system-prompt prefix
        </label>
        <span className="count" aria-live="polite">
          Step {pool.step}: {used} of {POOL_BLOCKS} blocks in use{full ? '. The pool is full, so new tokens must wait or a sequence is preempted' : ''}
        </span>
      </div>
      <Legend
        items={[
          { name: 'Shared prefix', color: COLOR.shared },
          { name: 'Sequence A', color: COLOR.A },
          { name: 'Sequence B', color: COLOR.B },
          { name: 'Sequence C', color: COLOR.C },
        ]}
      />
      <div className="wk-blocks">
        {pool.blocks.map((b, i) => (
          <div key={i} className={'wk-block' + (b ? '' : ' free')} style={b ? ({ '--c': COLOR[b.owner] } as CSSProperties) : undefined}>
            <span>#{i}</span>
            <span>{b ? `${b.used}/${BLOCK_SIZE}${b.refs > 1 ? ` ×${b.refs}` : ''}` : 'free'}</span>
          </div>
        ))}
      </div>
      <div className="out">
        {pool.sequences.map((s) => `Sequence ${s.name}: ${s.tokens} tokens, block table [${s.blocks.join(', ')}]`).join('\n')}
      </div>
    </Widget>
  )
}
