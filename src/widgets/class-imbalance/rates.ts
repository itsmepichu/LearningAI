import type { Project, ProjectId } from '../../data/projects'
import type { DataReader } from '../kit'

export interface RareClass {
  file: string
  name: string
  rate: number
}

const RARE: Record<ProjectId, { file: string; column: string; value: string; name: string }> = {
  harbor: { file: 'tickets.csv', column: 'category', value: 'security', name: 'security tickets' },
  store: { file: 'orders.csv', column: 'returned', value: '1', name: 'returned orders' },
  bank: { file: 'transactions.csv', column: 'fraud', value: '1', name: 'fraud' },
  travel: { file: 'bookings.csv', column: 'cancelled', value: '1', name: 'cancelled bookings' },
}

/** How rare the project's positive class really is, counted from its dataset. */
export async function loadRareClass(p: Project, read: DataReader): Promise<RareClass> {
  const { file, column, value, name } = RARE[p.id]
  const rows = await read.csv(file)
  return { file, name, rate: rows.filter((r) => r[column] === value).length / rows.length }
}
