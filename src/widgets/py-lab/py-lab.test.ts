import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { totalBytes } from '../kit/download.ts'
import { PYTHON } from '../engines/specs.ts'
import { BIGRAM_SCRIPT, MANUAL_TEXT } from './bigram-script.ts'
import { LAB_IDS, loadLab, splitLines, trimTraceback, type LabBundle, type LabCheck } from './labs.ts'

/** Runs the graded labs the way the worker does, on a local Python. This never downloads anything: without NumPy these skip. */
const PYTHON_BIN = process.env.LAB_PYTHON ?? 'python3'
const noPython = (() => {
  const r = spawnSync(PYTHON_BIN, ['-c', 'import numpy'], { encoding: 'utf8' })
  return r.status === 0 ? false : `needs ${PYTHON_BIN} with NumPy`
})()

const RUNNER = String.raw`
import json, sys
ns = {"__name__": "__main__"}
code = open(sys.argv[1], encoding="utf-8").read()
grader = open(sys.argv[2], encoding="utf-8").read()
try:
    exec(compile(code, "lab.py", "exec"), ns)
except Exception as e:
    print("\n@@RESULT@@" + json.dumps({"raised": f"{type(e).__name__}: {e}"}))
    sys.exit(0)
exec(compile(grader, "grader.py", "exec"), ns)
print("\n@@RESULT@@" + json.dumps({"checks": json.loads(ns["__result__"])}))
`

function run(code: string, lab: LabBundle, files = lab.files): { raised?: string; checks?: LabCheck[]; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'py-lab-'))
  try {
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text, 'utf8')
    writeFileSync(join(dir, '__code.py'), code, 'utf8')
    writeFileSync(join(dir, '__grader.py'), lab.grader, 'utf8')
    writeFileSync(join(dir, '__runner.py'), RUNNER, 'utf8')
    const out = execFileSync(PYTHON_BIN, ['__runner.py', '__code.py', '__grader.py'], { cwd: dir, encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' } })
    const at = out.lastIndexOf('@@RESULT@@')
    return { ...JSON.parse(out.slice(at + 10)), out: out.slice(0, at) }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

for (const id of PROJECT_IDS) {
  for (const labId of LAB_IDS) {
    test(`${labId} (${id}): the worked solution passes every check`, { skip: noPython }, async () => {
      const lab = await loadLab(labId)(projectOf(id), readerOf(id))
      const r = run(lab.solution, lab)
      assert.equal(r.raised, undefined, r.raised ?? '')
      assert.ok(r.checks!.length >= 5, `${r.checks!.length} checks`)
      for (const c of r.checks!) assert.ok(c.pass, `${c.name}: ${c.detail}`)
    })
  }
  for (const labId of LAB_IDS.filter((l) => l !== 'bigram')) {
    test(`${labId} (${id}): the starter does not pass, and a wrong answer fails`, { skip: noPython }, async () => {
      const lab = await loadLab(labId)(projectOf(id), readerOf(id))
      const r = run(lab.starter, lab)
      assert.ok(r.raised || r.checks!.some((c) => !c.pass), 'the starter must not pass as it stands')
    })
  }
  test(`labs (${id}): each names what it proves and uses dataset files that exist`, async () => {
    for (const labId of LAB_IDS) {
      const lab = await loadLab(labId)(projectOf(id), readerOf(id))
      assert.ok(lab.brief.includes(projectOf(id).company), `${labId} brief names the company`)
      assert.match(lab.proves, /\b(not|nothing)\b/, `${labId} says what it does not show`)
      assert.ok(lab.sources.length >= 1)
      for (const f of lab.sources) assert.ok(readerOf(id).text(f), f)
    }
  })
}

const wrong = (code: string, from: string, to: string) => {
  assert.ok(code.includes(from), from)
  return code.replace(from, to)
}

test('graders catch a wrong answer, not only a missing one', { skip: noPython }, async () => {
  const fail = async (labId: (typeof LAB_IDS)[number], from: string, to: string, names: RegExp) => {
    const lab = await loadLab(labId)(projectOf('bank'), readerOf('bank'))
    const r = run(wrong(lab.solution, from, to), lab)
    const failed = (r.checks ?? []).filter((c) => !c.pass).map((c) => c.name)
    assert.ok(failed.some((n) => names.test(n)), `${labId}: expected a failure matching ${names}, got ${failed}`)
  }
  await fail('stats', 'np.percentile(values, 95)', 'np.percentile(values, 90)', /95th/)
  await fail('stats', 'skew_gap = mean - median', 'skew_gap = median - mean', /skew/)
  await fail('metrics', 'tp / (tp + fp) if tp + fp else 0.0', 'tp / (tp + fp + 1)', /Precision/)
  await fail('cosine', 'np.argsort(scores)[::-1][:k]', 'np.argsort(scores)[:k]', /top_k/)
  await fail('cosine', 'denom = np.linalg.norm(X, axis=1) * np.linalg.norm(q)', 'denom = np.linalg.norm(X, axis=1)', /norm of the query/)
  await fail('bigram', 'if h["val"] < best_val:', 'if h["step"] == 0:', /lowest validation/)
})

test('the manual’s own text reproduces the run the appendix reports', { skip: noPython }, async () => {
  const lab = await loadLab('bigram')(projectOf('harbor'), readerOf('harbor'))
  const manual = lab.variants![0]
  const r = run(lab.starter, lab, manual.files)
  for (const c of r.checks!) assert.ok(c.pass, `${c.name}: ${c.detail}`)
  assert.match(r.out, /vocab 30 {2}params 900/)
  // The appendix: unigram 2.850, bigram 2.271. NumPy versions may differ slightly, as it says.
  const m = r.out.match(/unigram test ([\d.]+) {2}bigram test ([\d.]+)/)!
  assert.ok(Math.abs(+m[1] - 2.85) < 0.01 && Math.abs(+m[2] - 2.271) < 0.05, m[0])
})

test('the script matches the one printed in Appendix A, apart from reading its text from files', () => {
  const page = readFileSync(new URL('../../content/pages/app-a/app-a-run.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  const printed = unescape(page.match(/<pre><code>([\s\S]*?)<\/code><\/pre>/)![1])
  const literal = (name: string) => new RegExp(`${name} = (?:"""[\\s\\S]*?"""|"[^\\n]*")`)
  const normal = printed
    .replace(literal('train_text'), 'train_text = open("train.txt").read()')
    .replace(literal('val_text'), 'val_text = open("val.txt").read()')
    .replace(literal('test_text'), 'test_text = open("test.txt").read()')
  assert.equal(BIGRAM_SCRIPT.trim(), normal.trim())
  assert.ok(printed.includes(MANUAL_TEXT.train.trim().split('\n')[0]))
  assert.ok(printed.includes(JSON.stringify(MANUAL_TEXT.val).slice(1, -1)), 'validation text')
  assert.ok(printed.includes(JSON.stringify(MANUAL_TEXT.test).slice(1, -1)), 'test text')
})

test('a traceback keeps the reader’s frames and drops Pyodide’s', () => {
  const raw = 'Traceback (most recent call last):\n  File "/lib/python314.zip/_pyodide/_base.py", line 619, in eval_code_async\n    await CodeRunner(\n  File "lab.py", line 2, in <module>\n    raise ValueError("x")\nValueError: x\n\n'
  assert.equal(trimTraceback(raw), 'Traceback (most recent call last):\n  File "lab.py", line 2, in <module>\n    raise ValueError("x")\nValueError: x')
  assert.equal(trimTraceback('SyntaxError: nope'), 'SyntaxError: nope', 'nothing to trim')
})

test('line splitting is seeded, lower-cased and has no overlap', () => {
  const lines = Array.from({ length: 80 }, (_, i) => `Line ${i}`)
  const a = splitLines(lines)
  assert.deepEqual(a, splitLines(lines))
  const parts = [a['train.txt'], a['val.txt'], a['test.txt']].map((t) => t.trim().split('\n'))
  assert.deepEqual(parts.map((p) => p.length), [40, 4, 4])
  assert.equal(new Set(parts.flat()).size, 48, 'no line in two splits')
  assert.ok(parts.flat().every((l) => l === l.toLowerCase()))
})

test('the download is declared before anything runs', () => {
  assert.ok(totalBytes(PYTHON) > 8e6 && totalBytes(PYTHON) < 11e6, String(totalBytes(PYTHON)))
  assert.deepEqual(PYTHON.needs, ['worker', 'wasm'])
})
