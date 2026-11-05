import { TENANCY } from '../cache-key/scenarios'
import { DataSource, ScrollRegion, Widget, useProject } from '../kit'
import { STORES, SURFACES, cellState, type CellState } from './matrix'

const CELL: Record<CellState, { mark: string; text: string; className: string }> = {
  pass: { mark: '✓', text: 'passing', className: 'wk-c-pass' },
  fail: { mark: '✕', text: 'failing', className: 'wk-c-fail' },
  na: { mark: '–', text: 'not applicable', className: 'wk-c-na' },
}

export default function IsolationGrid() {
  const project = useProject()
  const tenant = TENANCY[project.id].tenant
  return (
    <Widget name="isolation-grid">
      <DataSource project={project} files={[]}>
        Tenant A and tenant B here are two of its {tenant}s. The matrix is an example state.
      </DataSource>
      <ScrollRegion label="Cross-tenant test results for each data store and surface">
        <table className="wk-matrix">
          <thead>
            <tr>
              <th>Data store</th>
              {SURFACES.map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STORES.map((store) => (
              <tr key={store}>
                <th scope="row">{store}</th>
                {SURFACES.map((surface) => {
                  const c = CELL[cellState(store, surface)]
                  return (
                    <td key={surface} className={c.className} title={`${store}, ${surface}: ${c.text}`}>
                      {c.mark}
                      <span className="sr-only"> {c.text}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      <ul className="wk-legend">
        {Object.values(CELL).map((c) => (
          <li key={c.text}>
            <span className={'wk-key ' + c.className} aria-hidden="true">
              {c.mark}
            </span>
            {c.text === 'not applicable' ? c.text : `automated cross-tenant test ${c.text}`}
          </li>
        ))}
      </ul>
    </Widget>
  )
}
