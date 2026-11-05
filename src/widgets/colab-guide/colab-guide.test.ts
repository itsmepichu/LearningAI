import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { MODEL, guideSteps, loadColabSeed, toNotebook } from './notebook.ts'

const PYTHON_BIN = process.env.LAB_PYTHON ?? 'python3'
const noPython = spawnSync(PYTHON_BIN, ['--version']).status === 0 ? false : `needs ${PYTHON_BIN}`

async function built(id: (typeof PROJECT_IDS)[number]) {
  const project = projectOf(id)
  const seed = await loadColabSeed(project, readerOf(id))
  return { project, seed, steps: guideSteps(project, seed) }
}

for (const id of PROJECT_IDS) {
  test(`${id}: the code carries this project's question and document`, async () => {
    const { project, seed, steps } = await built(id)
    const code = steps.map((s) => s.code ?? '').join('\n')
    assert.ok(code.includes(JSON.stringify(seed.question)), 'question')
    assert.ok(code.includes(seed.doc.body.slice(0, 20)), 'document')
    assert.ok(code.includes(project.company) && code.includes(project.assistant), 'names')
  })

  test(`${id}: the notebook is valid and every code cell parses as Python`, { skip: noPython }, async () => {
    const { project, steps } = await built(id)
    const nb = JSON.parse(toNotebook(project, steps))
    assert.equal(nb.nbformat, 4)
    assert.equal(nb.metadata.accelerator, 'GPU')
    const code = nb.cells.filter((c: { cell_type: string }) => c.cell_type === 'code')
    assert.equal(code.length, steps.filter((s) => s.code).length)
    assert.equal(new Set(nb.cells.map((c: { id: string }) => c.id)).size, nb.cells.length, 'cell ids are unique')
    for (const c of code) assert.deepEqual([c.outputs, c.execution_count], [[], null])
    // Shell lines are Colab's own syntax, not Python, so they are blanked before parsing.
    const python = code.map((c: { source: string[] }) => c.source.join('').replace(/^!.*$/gm, '')).join('\n')
    const dir = mkdtempSync(join(tmpdir(), 'colab-guide-'))
    try {
      writeFileSync(join(dir, 'all.py'), python, 'utf8')
      const r = spawnSync(PYTHON_BIN, ['-c', 'import sys; compile(open(sys.argv[1], encoding="utf-8").read(), "all.py", "exec")', join(dir, 'all.py')], { encoding: 'utf8' })
      assert.equal(r.status, 0, r.stderr)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
}

test('the steps set up the GPU before any code uses it, and hand it back at the end', async () => {
  const { steps } = await built('harbor')
  const gpu = steps.findIndex((s) => /Turn on the GPU/.test(s.title))
  const firstCode = steps.findIndex((s) => s.code)
  assert.ok(gpu >= 0 && gpu < firstCode)
  assert.match(steps[gpu].text, /Runtime, then Change runtime type/)
  assert.match(steps[steps.length - 1].text, /Disconnect and delete runtime/)
  assert.ok(steps[firstCode].code!.includes('torch.cuda.is_available()'), 'the first code checks for the GPU')
  assert.ok(steps.some((s) => s.code?.includes(MODEL)))
})

test('code that runs in Colab keeps its escapes for Python', async () => {
  const { steps } = await built('bank')
  const ask = steps.find((s) => s.code?.includes('def ask'))!.code!
  assert.ok(ask.includes(String.raw`say so.\n\nDocument: `), 'the newline stays an escape inside the Python string')
})
