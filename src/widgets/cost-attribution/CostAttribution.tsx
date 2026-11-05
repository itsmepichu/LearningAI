import { useState } from 'react'
import { BarList, DataSource, SERIES, Widget, fmt, pct, useProject } from '../kit'
import { GROUPINGS, TOTAL, spendRows, type Grouping } from './spend'

export default function CostAttribution() {
  const project = useProject()
  const [grouping, setGrouping] = useState<Grouping>(GROUPINGS[0])
  return (
    <Widget name="cost-attribution">
      <DataSource project={project} files={[]}>
        Example data: one illustrative month, ${fmt(TOTAL)} in total.
      </DataSource>
      <div className="ctl">
        {GROUPINGS.map((g) => (
          <button key={g} type="button" className={'btn' + (g === grouping ? ' primary' : '')} aria-pressed={g === grouping} onClick={() => setGrouping(g)}>
            {g}
          </button>
        ))}
      </div>
      <BarList
        items={spendRows(project.id, grouping).map(([label, dollars], i) => ({
          label,
          value: dollars,
          text: `$${fmt(dollars)} · ${pct(dollars / TOTAL, 1)}`,
          color: i === 0 ? SERIES[1] : SERIES[0],
        }))}
      />
    </Widget>
  )
}
