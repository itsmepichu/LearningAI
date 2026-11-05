import { useId, useMemo, useState } from 'react'
import { DataGate, DataSource, KpiRow, Slider, Widget, fmt, useProjectData } from '../kit'
import { chunkDocument, chunkStats, type ChunkMode } from './chunk'
import { loadChunkSource } from './sources'

export default function Chunking() {
  const modeId = useId()
  const [size, setSize] = useState(40)
  const [overlap, setOverlap] = useState(8)
  const [mode, setMode] = useState<ChunkMode>('fixed')
  const state = useProjectData(loadChunkSource)
  const ov = Math.min(overlap, size - 1)
  const chunks = useMemo(() => (state.data ? chunkDocument(state.data.title, state.data.sections, mode, size, ov) : []), [state.data, mode, size, ov])
  return (
    <Widget name="chunking">
      <DataGate state={state}>
        {(src, project) => {
          const stats = chunkStats(src.sections, mode, chunks)
          return (
            <>
              <DataSource project={project} files={src.files}>
                {src.title}
              </DataSource>
              <div className="row2">
                <Slider label="Chunk size (words)" value={size} min={15} max={120} onChange={setSize} />
                <Slider label="Overlap (words)" value={ov} min={0} max={30} onChange={setOverlap} />
                <label htmlFor={modeId}>
                  Strategy
                  <select id={modeId} value={mode} onChange={(e) => setMode(e.target.value as ChunkMode)}>
                    <option value="fixed">fixed-size</option>
                    <option value="section">paragraph-aware</option>
                  </select>
                </label>
              </div>
              <KpiRow
                items={[
                  { label: 'chunks', value: fmt(stats.chunks) },
                  { label: `words stored, from ${fmt(stats.sourceWords)} in the source`, value: fmt(stats.storedWords) },
                  { label: 'extra storage from overlap', value: `+${fmt(stats.overlapOverheadPct)}%` },
                  { label: 'context header words added', value: fmt(stats.headerWords) },
                  { label: 'chunks that mix sections', value: fmt(stats.mixed), tone: stats.mixed ? 'warn' : 'ok' },
                ]}
              />
              <div className="wk-chunks">
                {chunks.map((c, i) => (
                  <div className="card wk-chunk" key={i}>
                    <div className="wk-chunk-m">
                      <span>
                        chunk {i + 1} · {c.words.length} words
                      </span>
                      {c.sections > 1 && <em>mixes {c.sections} sections</em>}
                    </div>
                    {c.header && <span className="wk-chunk-h">{c.header}: </span>}
                    {c.overlap > 0 && <mark className="wk-ov">{c.words.slice(0, c.overlap).join(' ')}</mark>} {c.words.slice(c.overlap).join(' ')}
                  </div>
                ))}
              </div>
            </>
          )
        }}
      </DataGate>
    </Widget>
  )
}
