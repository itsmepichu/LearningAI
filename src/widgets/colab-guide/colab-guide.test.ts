import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { GUIDES, getGuide, type GuideId } from './guides.ts'
import { MODEL } from './decoding.ts'
import { GENERAL_PROBES } from './qlora.ts'
import { NANOGPT_COMMIT, TRAIN_FLAGS } from './train-gpt.ts'
import { CONCURRENCY, VLLM_VERSION } from './vllm-bench.ts'
import { OPEN_COLAB, RUN_A_CELL, TURN_ON_GPU, notebookName, toNotebook, type GuideDef, type GuideStep } from './notebook.ts'

const PYTHON_BIN = process.env.LAB_PYTHON ?? 'python3'
const noPython = spawnSync(PYTHON_BIN, ['--version']).status === 0 ? false : `needs ${PYTHON_BIN}`
const IDS = Object.keys(GUIDES) as GuideId[]

async function built(guide: GuideId, id: (typeof PROJECT_IDS)[number]) {
  const def = GUIDES[guide] as unknown as GuideDef<unknown>
  const project = projectOf(id)
  const seed = await def.load(project, readerOf(id))
  return { def, project, seed, steps: def.steps(project, seed) }
}
const codeOf = (steps: GuideStep[]) => steps.map((s) => s.code ?? '').join('\n')

/** Colab's shell (!) and magic (%) lines are not Python, so they are blanked before parsing. */
function parsesAsPython(cells: string[]) {
  const python = cells.map((c) => c.replace(/^[!%].*$/gm, '')).join('\n')
  const dir = mkdtempSync(join(tmpdir(), 'colab-guide-'))
  try {
    writeFileSync(join(dir, 'all.py'), python, 'utf8')
    const r = spawnSync(PYTHON_BIN, ['-c', 'import sys; compile(open(sys.argv[1], encoding="utf-8").read(), "all.py", "exec")', join(dir, 'all.py')], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('an unknown or missing guide id falls back to the 5.6 guide', () => {
  assert.equal(getGuide(undefined).id, 'decoding')
  assert.equal(getGuide('nope').id, 'decoding')
  assert.equal(getGuide('qlora').id, 'qlora')
})

for (const guide of IDS) {
  test(`${guide}: shares the setup steps, checks the GPU first and hands it back at the end`, async () => {
    const { steps } = await built(guide, 'harbor')
    assert.deepEqual(steps.slice(0, 3), [OPEN_COLAB, TURN_ON_GPU, RUN_A_CELL])
    assert.equal(steps[3].title, 'Check that you have a GPU')
    assert.ok(steps[3].code?.includes('nvidia-smi'), 'step 4 is the GPU check, which the finish step refers back to')
    assert.equal(steps.findIndex((s) => s.code), 3, 'no code runs before the GPU check')
    assert.match(steps[1].text, /Runtime, then Change runtime type/)
    assert.match(steps[steps.length - 1].text, /Disconnect and delete runtime/)
    assert.equal(new Set(steps.map((s) => s.title)).size, steps.length, 'step titles are unique, since they are list keys')
  })

  for (const id of PROJECT_IDS) {
    test(`${guide} · ${id}: the notebook is valid and every code cell parses as Python`, { skip: noPython }, async () => {
      const { def, project, steps } = await built(guide, id)
      const nb = JSON.parse(toNotebook(def, def.neutral ? null : project, steps))
      assert.equal(nb.nbformat, 4)
      assert.equal(nb.metadata.accelerator, 'GPU')
      const code = nb.cells.filter((c: { cell_type: string }) => c.cell_type === 'code')
      assert.equal(code.length, steps.filter((s) => s.code).length)
      assert.equal(new Set(nb.cells.map((c: { id: string }) => c.id)).size, nb.cells.length, 'cell ids are unique')
      for (const c of code) assert.deepEqual([c.outputs, c.execution_count], [[], null])
      assert.equal(nb.cells[0].source.join('').includes(project.company), !def.neutral, 'only a project guide names the company')
      parsesAsPython(code.map((c: { source: string[] }) => c.source.join('')))
    })
  }
}

test('notebook names carry the project unless the guide is neutral', () => {
  assert.equal(notebookName(GUIDES.decoding, 'travel'), 'decoding-on-a-gpu-travel.ipynb')
  assert.equal(notebookName(GUIDES['train-gpt'], 'travel'), 'train-a-small-gpt.ipynb')
})

for (const id of PROJECT_IDS) {
  test(`decoding · ${id}: the code carries this project's question, document and names`, async () => {
    const { project, seed, steps } = await built('decoding', id)
    const s = seed as { question: string; doc: { body: string } }
    const code = codeOf(steps)
    assert.ok(code.includes(JSON.stringify(s.question)), 'question')
    assert.ok(code.includes(s.doc.body.slice(0, 20)), 'document')
    assert.ok(code.includes(project.company) && code.includes(project.assistant), 'names')
    assert.ok(code.includes(MODEL))
  })

  test(`qlora · ${id}: every labelled row is in the code, and the probes are general`, async () => {
    const { seed, steps } = await built('qlora', id)
    const s = seed as { rows: { text: string; label: string }[] }
    const code = codeOf(steps)
    assert.ok(s.rows.length >= 200, 'enough rows to train on and hold some out')
    for (const r of s.rows) assert.ok(code.includes(`(${JSON.stringify(r.text)}, ${JSON.stringify(r.label)}),`), r.text)
    assert.ok(new Set(s.rows.map((r) => r.label)).size >= 3)
    for (const q of GENERAL_PROBES) assert.ok(code.includes(JSON.stringify(q)))
    assert.match(code, /load_in_4bit=True/)
    assert.match(code, /bnb_4bit_compute_dtype=torch\.float16/, 'a T4 has no fast bfloat16')
    assert.match(code, /disable_adapter\(\)/, 'general answers are compared with the adapter off')
  })

  test(`vllm-bench · ${id}: pinned, two charts, and the project's documents as the shared prefix`, async () => {
    const { project, seed, steps } = await built('vllm-bench', id)
    const s = seed as { context: string; docIds: string[]; question: string }
    const code = codeOf(steps)
    assert.ok(code.includes(`vllm==${VLLM_VERSION}`))
    assert.ok(code.includes('"--dtype", "half"'), 'a T4 has no fast bfloat16')
    assert.ok(code.includes(JSON.stringify(CONCURRENCY)))
    assert.match(code, /plt\.subplots\(1, 2/, 'throughput and latency go on two charts, never one axis')
    assert.ok(s.docIds.length >= 2 && s.context.length >= 5000, 'a long shared prefix')
    assert.ok(code.includes(JSON.stringify(s.context)) && code.includes(JSON.stringify(s.question)))
    assert.ok(code.includes(project.company) && code.includes(project.assistant))
  })
}

test('train-gpt: pinned nanoGPT, float16 on a T4, and the same code for every project', async () => {
  const a = codeOf((await built('train-gpt', 'harbor')).steps)
  const b = codeOf((await built('train-gpt', 'bank')).steps)
  assert.equal(a, b)
  assert.match(NANOGPT_COMMIT, /^[0-9a-f]{40}$/)
  assert.ok(a.includes(`git checkout -q ${NANOGPT_COMMIT}`))
  for (const f of TRAIN_FLAGS) assert.ok(a.includes(f))
  assert.match(a, /--device=cpu --dtype=float32/, 'the CPU timing run cannot use float16')
})

test('decoding: escapes stay escapes inside the Python strings', async () => {
  const ask = (await built('decoding', 'bank')).steps.find((s) => s.code?.includes('def ask'))!.code!
  assert.ok(ask.includes(String.raw`say so.\n\nDocument: `), 'the newline stays an escape inside the Python string')
})
