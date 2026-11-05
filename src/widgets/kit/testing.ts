/** Test helpers: the real generated datasets, read from disk. Only `*.test.ts` files import this. */
import { readFileSync } from 'node:fs'
import { parseCsv } from './csv.ts'
import type { Project, ProjectId } from '../../data/projects'
import type { DataReader } from './dataset'

const ROOT = new URL('../../../', import.meta.url)
const text = (path: string) => readFileSync(new URL(path, ROOT), 'utf8')
const projects = JSON.parse(text('src/content/projects.json')).projects as Project[]

export const PROJECT_IDS = projects.map((p) => p.id)

export const projectOf = (id: ProjectId): Project => projects.find((p) => p.id === id)!

export function readerOf(id: ProjectId): DataReader {
  return {
    json: async <T>(file: string) => JSON.parse(text(`public/datasets/${id}/${file}`)) as T,
    csv: async (file, rows) => {
      const all = parseCsv(text(`public/datasets/${id}/${file}`))
      return rows ? all.slice(0, rows) : all
    },
    text: async (file) => text(`public/datasets/${id}/${file}`),
  }
}
