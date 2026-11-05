import { useState } from 'react'
import { DataGate, DataSource, KpiRow, ScrollRegion, Widget, fmt, useProjectData } from '../kit'
import { FIELD_IDS, evaluate, hitRate, keyPreview, type FieldId } from './key'
import { casesFor, fieldLabel, loadCachedQuestion } from './scenarios'

export default function CacheKey() {
  const [on, setOn] = useState<ReadonlySet<FieldId>>(new Set())
  const state = useProjectData(loadCachedQuestion)
  const toggle = (id: FieldId, checked: boolean) => {
    const next = new Set(on)
    if (checked) next.add(id)
    else next.delete(id)
    setOn(next)
  }
  return (
    <Widget name="cache-key">
      <DataGate state={state}>
        {({ file, question }, project) => {
          const { results, unsafe, securityPresent } = evaluate(on, casesFor(project.id))
          return (
            <>
              <DataSource project={project} files={[file]}>
                The cases are scripted. The hit-rate multipliers are illustrative.
              </DataSource>
              <p className="wk-q">
                <b>Cached question:</b> “{question}”
              </p>
              <div className="row2">
                <label>
                  <input type="checkbox" checked disabled />
                  Normalised question text (always)
                </label>
                {FIELD_IDS.map((id) => (
                  <label key={id}>
                    <input type="checkbox" checked={on.has(id)} onChange={(e) => toggle(id, e.target.checked)} />
                    {fieldLabel(id, project.id)}
                  </label>
                ))}
              </div>
              <div className="out">{keyPreview(on)}</div>
              <KpiRow
                items={[
                  { label: 'estimated hit rate', value: `${fmt(hitRate(on), 1)}%` },
                  { label: 'unsafe scenarios', value: `${unsafe} of ${results.length}`, tone: unsafe ? 'bad' : 'ok' },
                  { label: 'security-critical fields', value: securityPresent ? 'present' : 'MISSING', tone: securityPresent ? 'ok' : 'bad' },
                ]}
              />
              <ScrollRegion label="What each scenario gets from the cache">
                <table>
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th>Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.needs}>
                        <td>{r.text}</td>
                        <td className={r.safe ? 'wk-yes' : r.severe ? 'wk-no' : 'wk-part'}>{r.safe ? '✓ Cache miss, so a fresh, correct answer.' : `✕ ${r.harm}`}</td>
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
