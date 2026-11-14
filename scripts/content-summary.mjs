// Writes src/content/checks/summary.json: question counts per chapter and section, so pages can show
// counts without loading every file. Runs automatically before `npm run dev` and `npm run build`.
// It only counts; it checks nothing.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = join(process.cwd(), 'src', 'content')
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))

const summary = { totals: { mcq: 0, interview: 0 }, chapters: {} }
for (const c of manifest.chapters) {
  const file = join(root, 'checks', `${c.id}.json`)
  if (!existsSync(file)) continue
  const data = JSON.parse(readFileSync(file, 'utf8'))
  const ch = { mcq: 0, interview: 0, sections: {} }
  for (const [tid, sec] of Object.entries(data)) {
    const s = { mcq: (sec.mcq ?? []).length, interview: (sec.interview ?? []).length }
    ch.sections[tid] = s
    ch.mcq += s.mcq
    ch.interview += s.interview
  }
  summary.chapters[c.id] = ch
  summary.totals.mcq += ch.mcq
  summary.totals.interview += ch.interview
}

writeFileSync(join(root, 'checks', 'summary.json'), JSON.stringify(summary, null, 1) + '\n')
console.log(`question counts written · ${summary.totals.mcq} choose-the-answer · ${summary.totals.interview} interview questions`)
