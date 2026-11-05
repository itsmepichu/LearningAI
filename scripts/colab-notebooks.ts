/**
 * Writes every Colab guide's notebook, for every example project, to a folder, so scripts/check_colab_guides.py can
 * run their code on a CPU. Usage: node scripts/colab-notebooks.ts <out-dir>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROJECT_IDS, projectOf, readerOf } from '../src/widgets/kit/testing.ts'
import { GUIDES, type GuideId } from '../src/widgets/colab-guide/guides.ts'
import { notebookName, toNotebook, type GuideDef } from '../src/widgets/colab-guide/notebook.ts'

const out = process.argv[2]
if (!out) {
  console.error('usage: node scripts/colab-notebooks.ts <out-dir>')
  process.exit(2)
}
mkdirSync(out, { recursive: true })
for (const id of Object.keys(GUIDES) as GuideId[]) {
  const def = GUIDES[id] as unknown as GuideDef<unknown>
  for (const pid of def.neutral ? PROJECT_IDS.slice(0, 1) : PROJECT_IDS) {
    const project = projectOf(pid)
    const seed = await def.load(project, readerOf(pid))
    const name = notebookName(def, pid)
    writeFileSync(join(out, name), toNotebook(def, def.neutral ? null : project, def.steps(project, seed)))
    console.log(join(out, name))
  }
}
