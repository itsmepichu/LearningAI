// Runs scripts/make_datasets.py with whichever Python is installed: python3, python, or `py -3` (the Windows launcher).
// Python is needed only for this script. Usage: npm run datasets
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = join(dirname(fileURLToPath(import.meta.url)), 'make_datasets.py')
const candidates = [['python3'], ['python'], ['py', '-3']]

for (const [cmd, ...pre] of candidates) {
  // On Windows, `python3` can be a Store stub that opens the Store instead of Python, so check the version first.
  const v = spawnSync(cmd, [...pre, '--version'], { encoding: 'utf8' })
  if (v.error || v.status !== 0 || !/Python 3/.test(`${v.stdout}${v.stderr}`)) continue
  const run = spawnSync(cmd, [...pre, script, ...process.argv.slice(2)], { stdio: 'inherit' })
  process.exit(run.status ?? 1)
}
console.error('Python 3 was not found. Tried: python3, python, py -3. Install Python 3 to regenerate the datasets.')
process.exit(1)
