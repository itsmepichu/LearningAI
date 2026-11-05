import { useId, useMemo, useState } from 'react'
import { DataSource, Widget, useProject } from '../kit'
import { SAMPLES, redact } from './redact'

function Editor({ sample }: { sample: string }) {
  const id = useId()
  const [text, setText] = useState(sample)
  const { pieces, counts } = useMemo(() => redact(text), [text])
  const replaced = Object.entries(counts).map(([kind, n]) => `${kind} ×${n}`)
  return (
    <>
      <label htmlFor={id} className="wk-q-in">
        Text sent to the model
        <textarea id={id} value={text} spellCheck={false} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="out wk-redacted">
        {pieces.map((p, i) => (p.tag ? <b key={i}>{p.text}</b> : p.text))}
        {`\n\nReplaced: ${replaced.join(', ') || 'nothing'}. Names are not detected by patterns.`}
      </div>
    </>
  )
}

export default function PiiRedact() {
  const project = useProject()
  return (
    <Widget name="pii-redact">
      <DataSource project={project} files={[]}>
        The message is invented, with test values only.
      </DataSource>
      {/* A new project brings a new message, so edits to the old one are not carried over. */}
      <Editor key={project.id} sample={SAMPLES[project.id]} />
    </Widget>
  )
}
