import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'

/** A dataset file as rows of text. A JSON file that is not a list of records has no rows: only its start can be shown. */
export type Table = { kind: 'table'; columns: string[]; rows: Record<string, string>[] } | { kind: 'text'; text: string }

/** What the explorer needs from the selected project: its files, and a reader to open one when the reader picks it. */
export interface Explorer {
  files: string[]
  read: DataReader
}

/** Loads nothing yet. A file is read only when the reader picks it, so the explorer costs nothing until used. */
export async function loadExplorer(project: Project, read: DataReader): Promise<Explorer> {
  return { files: project.datasets.map((d) => d.file), read }
}

const cell = (v: unknown): string => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))

/** Opens one file of the project's dataset as a table. */
export async function loadTable(read: DataReader, file: string): Promise<Table> {
  if (file.endsWith('.csv')) {
    const rows = await read.csv(file)
    return { kind: 'table', columns: rows.length ? Object.keys(rows[0]) : [], rows }
  }
  const json = await read.json<unknown>(file)
  if (Array.isArray(json) && json.length > 0 && json.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
    const columns: string[] = []
    for (const r of json as Record<string, unknown>[]) for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k)
    const rows = (json as Record<string, unknown>[]).map((r) => Object.fromEntries(columns.map((c) => [c, cell(r[c])])))
    return { kind: 'table', columns, rows }
  }
  return { kind: 'text', text: JSON.stringify(json, null, 1).slice(0, 4000) }
}

const toNumber = (v: string): number | null => {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export interface ColumnInfo {
  name: string
  /** At least nine in ten of its non-empty values are numbers. */
  numeric: boolean
  /** How many different values it holds. */
  distinct: number
  /** Rows where it is empty. */
  empty: number
}

export function describeColumns(columns: string[], rows: Record<string, string>[]): ColumnInfo[] {
  return columns.map((name) => {
    const seen = new Set<string>()
    let filled = 0
    let numbers = 0
    for (const r of rows) {
      const v = r[name] ?? ''
      seen.add(v)
      if (v.trim() === '') continue
      filled++
      if (toNumber(v) !== null) numbers++
    }
    return { name, numeric: filled > 0 && numbers / filled >= 0.9, distinct: seen.size, empty: rows.length - filled }
  })
}

export interface Tally {
  value: string
  count: number
  share: number
}

/** How many rows hold each value of a column, most common first. A blank value is shown as "(empty)". */
export function countBy(rows: Record<string, string>[], column: string, top = 12): { tallies: Tally[]; others: number } {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const v = (r[column] ?? '') === '' ? '(empty)' : r[column]
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  const all = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const tallies = all.slice(0, top).map(([value, count]) => ({ value, count, share: rows.length ? count / rows.length : 0 }))
  const others = all.slice(top).reduce((a, [, n]) => a + n, 0)
  return { tallies, others }
}

export type Op = 'is' | 'is not' | 'contains' | 'above' | 'below'
export const OPS: Op[] = ['is', 'is not', 'contains', 'above', 'below']

/** Whether one row matches the filter. "above" and "below" compare numbers, so a row whose value is not a number never matches. */
export function matches(row: Record<string, string>, column: string, op: Op, value: string): boolean {
  const v = row[column] ?? ''
  switch (op) {
    case 'is':
      return v === value
    case 'is not':
      return v !== value
    case 'contains':
      return v.toLowerCase().includes(value.toLowerCase())
    case 'above':
    case 'below': {
      const a = toNumber(v)
      const b = toNumber(value)
      if (a === null || b === null) return false
      return op === 'above' ? a > b : a < b
    }
  }
}

/** The rows that match the filter. An empty value means no filter, so a half-typed filter does not empty the table. */
export function scopeRows(rows: Record<string, string>[], column: string, op: Op, value: string): Record<string, string>[] {
  return value === '' ? rows : rows.filter((r) => matches(r, column, op, value))
}

/** How many rows match one filter, and what share of all rows that is. */
export function countWhere(rows: Record<string, string>[], column: string, op: Op, value: string): { count: number; total: number; share: number } {
  const count = rows.reduce((n, r) => n + (matches(r, column, op, value) ? 1 : 0), 0)
  return { count, total: rows.length, share: rows.length ? count / rows.length : 0 }
}

/** The mean of a column's numbers. Empty and non-numeric cells are skipped, and counted so the reader can see how many. */
export function meanOf(rows: Record<string, string>[], column: string): { mean: number; used: number; skipped: number } | null {
  let sum = 0
  let used = 0
  for (const r of rows) {
    const n = toNumber(r[column] ?? '')
    if (n === null) continue
    sum += n
    used++
  }
  return used ? { mean: sum / used, used, skipped: rows.length - used } : null
}
