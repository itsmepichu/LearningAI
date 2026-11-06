import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { projectMessages, SNIPPET_IDS, SNIPPETS, type SnippetBundle } from './snippets.ts'

/** Runs each snippet on a local Python, as the worker would, then its check. Without NumPy these skip. */
const PYTHON_BIN = process.env.LAB_PYTHON ?? 'python3'
const noPython = spawnSync(PYTHON_BIN, ['-c', 'import numpy'], { encoding: 'utf8' }).status === 0 ? false : `needs ${PYTHON_BIN} with NumPy`

function run(bundle: SnippetBundle, check: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'py-snippet-'))
  try {
    for (const [name, text] of Object.entries(bundle.files)) writeFileSync(join(dir, name), text, 'utf8')
    writeFileSync(join(dir, 'snippet.py'), bundle.code + '\n\n# --- test check ---\n' + check + '\n', 'utf8')
    return execFileSync(PYTHON_BIN, ['snippet.py'], { cwd: dir, encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' } })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

for (const pid of PROJECT_IDS) {
  test(`messages (${pid}): English plus at least one other language, capped`, async () => {
    const { rows } = await projectMessages(projectOf(pid), readerOf(pid))
    const langs = new Set(rows.map((r) => r.language))
    assert.ok(langs.has('en'))
    assert.ok(langs.size >= 2, [...langs].join(','))
    assert.ok(rows.filter((r) => r.language === 'en').length >= 15)
    assert.ok(rows.every((r) => typeof r.text === 'string' && r.text.length > 0))
  })
  for (const sid of SNIPPET_IDS) {
    const s = SNIPPETS[sid]
    if ('neutral' in s && s.neutral && pid !== PROJECT_IDS[0]) continue
    test(`${sid} (${pid}): runs, prints, and passes its check`, { skip: noPython }, async () => {
      const bundle = await s.build(projectOf(pid), readerOf(pid))
      const out = run(bundle, s.check)
      assert.ok(out.trim().split('\n').length >= 3, out)
    })
  }
}

test('snippets say what they do not show, and neutral ones read no data', async () => {
  for (const sid of SNIPPET_IDS) {
    const s = SNIPPETS[sid]
    assert.match(s.proves, /\b(not|nothing)\b/, `${sid} says what it does not show`)
    const b = await s.build(projectOf('harbor'), readerOf('harbor'))
    if ('neutral' in s && s.neutral) assert.deepEqual(b.sources, [], sid)
    else assert.ok(b.sources.length >= 1, sid)
  }
})
