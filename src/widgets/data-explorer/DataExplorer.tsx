import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { DataGate, DataSource, ScrollRegion, Widget, fmt, pct, useProjectData } from '../kit'
import type { Project } from '../../data/projects'
import { OPS, countBy, countWhere, describeColumns, loadExplorer, loadTable, meanOf, scopeRows, type Explorer, type Op, type Table } from './explorer'

type Loaded = { file: string; table: Table } | { file: string; error: true }

function Tool({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="wk-de-tool">
      <legend>{title}</legend>
      {children}
    </fieldset>
  )
}

function Explore({ explorer, project, file: wanted }: { explorer: Explorer; project: Project; file?: string }) {
  const id = useId()
  const [file, setFile] = useState(wanted && explorer.files.includes(wanted) ? wanted : explorer.files[0])
  // A link elsewhere on the page can pick the file: follow it when it changes.
  const [seen, setSeen] = useState(wanted)
  if (wanted !== seen) {
    setSeen(wanted)
    if (wanted && explorer.files.includes(wanted)) setFile(wanted)
  }
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  useEffect(() => {
    let live = true
    loadTable(explorer.read, file).then(
      (table) => live && setLoaded({ file, table }),
      () => live && setLoaded({ file, error: true }),
    )
    return () => {
      live = false
    }
  }, [explorer, file])

  const current = loaded && loaded.file === file ? loaded : null
  const info = project.datasets.find((d) => d.file === file)
  return (
    <>
      <label className="wk-q-in">
        File
        <select value={file} onChange={(e) => setFile(e.target.value)}>
          {explorer.files.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </label>
      {info && (
        <p className="wk-q">
          {info.what} <span className="muted">{info.notes}</span>
        </p>
      )}
      {!current && <div className="wk-state" role="status">Opening {file}…</div>}
      {current && 'error' in current && (
        <div className="wk-state" role="alert">Could not open {file}. Check your connection and pick the file again.</div>
      )}
      {current && 'table' in current && current.table.kind === 'text' && (
        <>
          <p className="wk-q">This file is not a list of records, so there is nothing to count. The start of it:</p>
          <pre className="out">{current.table.text}</pre>
        </>
      )}
      {current && 'table' in current && current.table.kind === 'table' && <TableTools key={file} idBase={`${id}-${file}`} table={current.table} />}
    </>
  )
}

function TableTools({ idBase, table }: { idBase: string; table: Extract<Table, { kind: 'table' }> }) {
  const { columns, rows } = table
  const cols = useMemo(() => describeColumns(columns, rows), [columns, rows])
  const numeric = cols.filter((c) => c.numeric)
  const [byCol, setByCol] = useState(cols.find((c) => !c.numeric && c.distinct > 1 && c.distinct <= 40)?.name ?? cols[0]?.name ?? '')
  const [fCol, setFCol] = useState(cols[0]?.name ?? '')
  const [op, setOp] = useState<Op>('is')
  const [value, setValue] = useState('')
  const [mCol, setMCol] = useState(numeric[0]?.name ?? '')
  const [scoped, setScoped] = useState(false)
  // With the box ticked, the count by value and the mean cover only the rows that match the filter: a rate within a group.
  const scope = useMemo(() => (scoped && fCol ? scopeRows(rows, fCol, op, value) : rows), [rows, scoped, fCol, op, value])

  const tally = useMemo(() => (byCol ? countBy(scope, byCol) : null), [scope, byCol])
  const filtered = useMemo(() => (fCol ? countWhere(rows, fCol, op, value) : null), [rows, fCol, op, value])
  const mean = useMemo(() => (mCol ? meanOf(scope, mCol) : null), [scope, mCol])
  const head = rows.slice(0, 8)

  return (
    <>
      <p className="wk-q"><b>{fmt(rows.length)}</b> rows, <b>{columns.length}</b> columns. First {head.length} rows:</p>
      <ScrollRegion label="First rows of the file">
        <table className="wk-de-table">
          <thead>
            <tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
          </thead>
          <tbody>
            {head.map((r, i) => (
              <tr key={i}>{columns.map((c) => <td key={c}>{r[c]}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      <p className="wk-q">
        Columns:{' '}
        {cols.map((c, i) => (
          <span key={c.name}>
            {i > 0 && ', '}
            <code>{c.name}</code> <span className="muted">({c.numeric ? 'numbers' : 'text'}, {fmt(c.distinct)} different{c.empty ? `, ${fmt(c.empty)} empty` : ''})</span>
          </span>
        ))}
      </p>

      <div className="wk-de-tools">
        <Tool title={scoped ? `Count rows by a column's values (${fmt(scope.length)} rows)` : "Count rows by a column's values"}>
          <label htmlFor={`${idBase}-by`}>Column</label>
          <select id={`${idBase}-by`} value={byCol} onChange={(e) => setByCol(e.target.value)}>
            {columns.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="out" aria-live="polite">
            {tally?.tallies.map((t) => `${t.value}: ${fmt(t.count)} (${pct(t.share, 1)})`).join('\n')}
            {tally && tally.others > 0 ? `\nAll other values: ${fmt(tally.others)}` : ''}
          </div>
        </Tool>

        <Tool title="Count rows that match one filter">
          <label htmlFor={`${idBase}-fc`}>Column</label>
          <select id={`${idBase}-fc`} value={fCol} onChange={(e) => setFCol(e.target.value)}>
            {columns.map((c) => <option key={c}>{c}</option>)}
          </select>
          <label htmlFor={`${idBase}-op`}>Test</label>
          <select id={`${idBase}-op`} value={op} onChange={(e) => setOp(e.target.value as Op)}>
            {OPS.map((o) => <option key={o}>{o}</option>)}
          </select>
          <label htmlFor={`${idBase}-v`}>Value</label>
          <input id={`${idBase}-v`} type="text" value={value} spellCheck={false} onChange={(e) => setValue(e.target.value)} />
          <div className="out" aria-live="polite">
            {filtered ? `${fmt(filtered.count)} of ${fmt(filtered.total)} rows match (${pct(filtered.share, 1)}).` : ''}
          </div>
          <label className="wk-de-scope">
            <input type="checkbox" checked={scoped} onChange={(e) => setScoped(e.target.checked)} /> Use this filter for the other two tools
          </label>
        </Tool>

        <Tool title="Mean of a number column">
          {numeric.length === 0 ? (
            <p className="wk-q">This file has no column of numbers.</p>
          ) : (
            <>
              <label htmlFor={`${idBase}-m`}>Column</label>
              <select id={`${idBase}-m`} value={mCol} onChange={(e) => setMCol(e.target.value)}>
                {numeric.map((c) => <option key={c.name}>{c.name}</option>)}
              </select>
              <div className="out" aria-live="polite">
                {mean ? `Mean ${fmt(mean.mean, Math.abs(mean.mean) < 1 ? 4 : 2)} over ${fmt(mean.used)} rows${mean.skipped ? `; ${fmt(mean.skipped)} empty or non-number rows skipped.` : '.'}` : 'No numbers in this column.'}
              </div>
            </>
          )}
        </Tool>
      </div>
    </>
  )
}

/**
 * A small viewer for the selected example project's dataset files: first rows, columns, counts by value, one filter, a mean.
 * It reads real files from /datasets and runs in the browser. Everything it counts is for the synthetic data, not for real customers.
 */
export default function DataExplorer({ file }: { file?: string }) {
  const state = useProjectData(loadExplorer)
  return (
    <Widget name="data-explorer">
      <DataGate state={state}>
        {(explorer, project) => (
          <>
            <DataSource project={project} files={[]}>
              Synthetic data, read in this page. Counts here describe these invented rows only.
            </DataSource>
            <Explore explorer={explorer} project={project} file={file} />
          </>
        )}
      </DataGate>
    </Widget>
  )
}
