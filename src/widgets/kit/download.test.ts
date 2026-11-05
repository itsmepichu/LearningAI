import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CallCancelled, Gate, ProgressTally, formatBytes, hostsOf, serve, totalBytes, unsupportedReason, type DownloadSpec, type GateEnv, type GateState, type WorkerLike } from './download.ts'

const SPEC: DownloadSpec = {
  id: 'fixture',
  version: '1',
  what: 'a fixture',
  files: [
    { label: 'runtime', bytes: 2_000_000, host: 'cdn.example' },
    { label: 'model', bytes: 8_000_000, host: 'models.example' },
  ],
  needs: ['worker', 'wasm'],
  docs: { label: 'docs', href: 'https://example.com' },
  load: { op: 'load' },
}

const env = (over: Partial<GateEnv> = {}): GateEnv => ({ worker: true, wasm: true, ...over })

class FakeWorker implements WorkerLike {
  sent: { id: number; op: string; args?: unknown }[] = []
  terminated = false
  onmessage: WorkerLike['onmessage'] = null
  onerror: WorkerLike['onerror'] = null
  postMessage(m: unknown) {
    this.sent.push(m as { id: number; op: string })
  }
  terminate() {
    this.terminated = true
  }
  reply(data: unknown) {
    this.onmessage?.({ data })
  }
}

function setup(over: Partial<GateEnv> = {}, store = new Map<string, string>()) {
  const made: FakeWorker[] = []
  const gate = new Gate(
    SPEC,
    () => {
      const w = new FakeWorker()
      made.push(w)
      return w
    },
    env(over),
    { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) },
  )
  return { gate, made, store }
}
const statusOf = (g: Gate): GateState['status'] => g.getState().status

test('sizes add up and read plainly', () => {
  assert.equal(totalBytes(SPEC), 10_000_000)
  assert.deepEqual(hostsOf(SPEC), ['cdn.example', 'models.example'])
  assert.equal(formatBytes(22_972_370), '23 MB')
  assert.equal(formatBytes(1_500_000), '1.5 MB')
  assert.equal(formatBytes(700_000), '0.7 MB')
  assert.equal(formatBytes(1_400_000_000), '1.4 GB')
})

test('the unsupported reason names what is missing, and only then', () => {
  assert.equal(unsupportedReason(['worker', 'wasm'], env()), null)
  assert.match(unsupportedReason(['worker'], env({ worker: false }))!, /Web Workers/)
  assert.match(unsupportedReason(['wasm'], env({ wasm: false }))!, /WebAssembly/)
  assert.equal(unsupportedReason(['worker'], env({ wasm: false })), null, 'only what the spec needs counts')
})

test('progress across files never runs backwards or passes 100', () => {
  const t = new ProgressTally(100)
  assert.equal(t.add({ file: 'a', loaded: 10, total: 20 }).percent, 10)
  assert.equal(t.add({ file: 'b', loaded: 40, total: 80 }).percent, 50)
  assert.equal(t.add({ file: 'a', loaded: 5, total: 20 }).percent, 50, 'a stale event does not move it back')
  assert.equal(t.add({ stage: 'Starting' }).percent, 50, 'a stage changes nothing')
  // Files bigger than the estimate raise the denominator rather than overflow.
  assert.deepEqual(new ProgressTally(10).add({ file: 'a', loaded: 30, total: 40 }), { loaded: 30, total: 40, percent: 75 })
  assert.equal(new ProgressTally(10).add({ file: 'a', loaded: 30 }).percent, 100)
})

test('nothing starts until the reader says yes', async () => {
  const { gate, made } = setup()
  assert.equal(statusOf(gate), 'checking')
  await gate.check()
  assert.equal(statusOf(gate), 'idle')
  assert.equal(made.length, 0, 'no worker before the opt-in')
  await assert.rejects(gate.call('embed'), /Nothing is loaded/)
})

test('an unsupported browser never starts a worker', async () => {
  const { gate, made } = setup({ wasm: false })
  await gate.check()
  assert.equal(statusOf(gate), 'unsupported')
  await gate.start()
  assert.equal(made.length, 0)
})

test('load, progress, ready, then calls work', async () => {
  const { gate, made, store } = setup()
  await gate.check()
  const started = gate.start()
  const w = made[0]
  assert.equal(w.sent[0].op, 'load')
  w.reply({ id: w.sent[0].id, type: 'progress', progress: { file: 'model', loaded: 5_000_000, total: 8_000_000 } })
  const s = gate.getState()
  assert.ok(s.status === 'loading' && s.percent === 50 && s.file === 'model')
  w.reply({ id: w.sent[0].id, type: 'result', result: { device: 'wasm' } })
  await started
  assert.deepEqual(gate.getState(), { status: 'ready', fromCache: false, info: { device: 'wasm' } })
  assert.equal([...store.values()][0], '1', 'remembers it finished')

  const events: unknown[] = []
  const call = gate.call<number>('add', [1, 2], (e) => events.push(e))
  const c = w.sent[1]
  assert.deepEqual([c.op, c.args], ['add', [1, 2]])
  w.reply({ id: c.id, type: 'progress', progress: { done: 1 } })
  w.reply({ id: c.id, type: 'result', result: 3 })
  assert.equal(await call, 3)
  assert.deepEqual(events, [{ done: 1 }])
})

test('a failure can be retried, with a fresh worker', async () => {
  const { gate, made } = setup()
  await gate.check()
  const first = gate.start()
  made[0].reply({ id: made[0].sent[0].id, type: 'error', message: 'network down' })
  await first
  const s = gate.getState()
  assert.ok(s.status === 'failed' && s.message === 'network down')
  assert.equal(made[0].terminated, true)
  const second = gate.start()
  assert.equal(made.length, 2)
  made[1].reply({ id: made[1].sent[0].id, type: 'result', result: null })
  await second
  assert.equal(statusOf(gate), 'ready')
})

test('a worker crash during load is a failure, not a hang', async () => {
  const { gate, made } = setup()
  await gate.check()
  const started = gate.start()
  made[0].onerror?.({ message: 'boom' })
  await started
  assert.equal(statusOf(gate), 'failed')
})

test('cancel returns to the offer and ends the worker', async () => {
  const { gate, made } = setup()
  await gate.check()
  const started = gate.start()
  gate.cancel()
  await started
  assert.equal(made[0].terminated, true)
  assert.deepEqual(gate.getState(), { status: 'idle', seen: false })
})

test('a later visit knows it finished before, and still waits for the reader', async () => {
  const store = new Map<string, string>()
  const a = setup({}, store)
  await a.gate.check()
  const p = a.gate.start()
  a.made[0].reply({ id: a.made[0].sent[0].id, type: 'result', result: null })
  await p
  const b = setup({}, store)
  await b.gate.check()
  assert.deepEqual(b.gate.getState(), { status: 'idle', seen: true })
  assert.equal(b.made.length, 0)
  const q = b.gate.start()
  b.made[0].reply({ id: b.made[0].sent[0].id, type: 'result', result: null })
  await q
  const s = b.gate.getState()
  assert.ok(s.status === 'ready' && s.fromCache)
})

test('restart ends a running call and loads again', async () => {
  const { gate, made } = setup()
  await gate.check()
  const p = gate.start()
  made[0].reply({ id: made[0].sent[0].id, type: 'result', result: null })
  await p
  const running = gate.call('forever')
  const again = gate.restart()
  await assert.rejects(running, CallCancelled)
  assert.equal(made[0].terminated, true)
  made[1].reply({ id: made[1].sent[0].id, type: 'result', result: null })
  await again
  assert.equal(statusOf(gate), 'ready')
})

test('serve routes messages and reports errors from the handler', async () => {
  const out: Record<string, unknown>[] = []
  const scope = { postMessage: (m: unknown) => void out.push(m as Record<string, unknown>), onmessage: null as ((e: { data: unknown }) => void) | null }
  serve(scope, {
    double: (n: number, emit) => {
      emit({ stage: 'working' })
      return n * 2
    },
    bad: () => {
      throw new Error('nope')
    },
  })
  await scope.onmessage!({ data: { id: 1, op: 'double', args: 4 } })
  assert.deepEqual(out.splice(0), [
    { id: 1, type: 'progress', progress: { stage: 'working' } },
    { id: 1, type: 'result', result: 8 },
  ])
  await scope.onmessage!({ data: { id: 2, op: 'bad' } })
  assert.deepEqual(out.splice(0), [{ id: 2, type: 'error', message: 'nope' }])
  await scope.onmessage!({ data: { id: 3, op: 'missing' } })
  assert.match(String(out[0].message), /Unknown operation/)
})
