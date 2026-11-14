import { useId, useState } from 'react'
import { BarList, Slider, Widget, bytesText } from '../kit'
import { GPU_COUNTS, MEMORY_GB, STAGES, firstComfortable, fitOf, perGpu } from './memory'

const COLOUR = { fits: 'var(--ok)', tight: 'var(--signal)', no: 'var(--bad)' } as const

export default function ZeroCalc() {
  const ids = [useId(), useId()]
  const [billions, setB] = useState(8)
  const [gpus, setG] = useState(8)
  const [gb, setGb] = useState(80)
  const cap = gb * 1e9
  const st = perGpu(billions * 1e9, gpus)
  const ok = firstComfortable(st, cap)
  return (
    <Widget name="zero-calc">
      <div className="row2">
        <Slider label="Parameters (B)" value={billions} min={1} max={180} onChange={setB} format={(v) => `${v}B`} />
        <label htmlFor={ids[0]}>GPUs <select id={ids[0]} value={gpus} onChange={(e) => setG(+e.target.value)}>{GPU_COUNTS.map((g) => <option key={g}>{g}</option>)}</select></label>
        <label htmlFor={ids[1]}>GPU memory <select id={ids[1]} value={gb} onChange={(e) => setGb(+e.target.value)}>{MEMORY_GB.map((g) => <option key={g} value={g}>{g} GB</option>)}</select></label>
      </div>
      <BarList
        max={Math.max(...st, cap)}
        items={st.map((v, i) => ({ label: STAGES[i], value: v, color: COLOUR[fitOf(v, cap)], text: `${bytesText(v)} per GPU${v > cap ? ' · does not fit' : ''}` }))}
      />
      <div className="out">
        {ok < 0 ? `Even stage 3 needs ${bytesText(st[3])} per GPU before activations: add GPUs, offload to CPU, or use LoRA/QLoRA (13.3).` : `Smallest stage leaving ≥ 30% headroom for activations: stage ${ok}.`}
      </div>
    </Widget>
  )
}
